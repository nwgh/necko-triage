BugTable = function (id, config, triage) {
    this.id = id;
    this.title = config["title"];
    this.query = config["query"];
    this.extraColumns = config["extra_columns"]
    this.rowSort = config["default_sort"];
    this.isUser = config["is_user"];
    this.triage = triage;
};
BugTable.formatters = {
    "ni-date": GetNI
};
BugTable.columnTitles = {
    "ni-date": "Last ni?"
};
BugTable.sorters = {
    "ni-date": SortByNI,
    "severity": SortBySeverity,
    "id": SortByID
};
BugTable.prototype.id = "";
BugTable.prototype.title = "";
BugTable.prototype.query = {};
BugTable.prototype.extraColumns = [];
BugTable.prototype.rowSort = null;
BugTable.prototype.rowSortDirection = null;
BugTable.prototype.triage = null;
BugTable.prototype.root = null;
BugTable.prototype.table = null;
BugTable.prototype.reloadSpan = null;
BugTable.prototype.data = null;
BugTable.prototype.invertSort = false;
BugTable.prototype.xhrError = function (xhr, status, errorThrown) {
    console.log("Error: " + errorThrown);
    console.log("Status: " + status);
    console.log(xhr);
    this.root.find(".error-message").text(error);
    this.root.find(".error-code").text(status);
    this.root.addClass("error");
};
BugTable.prototype.displayError = function (error, code) {
    console.log("Bugzilla Error: " + error);
    console.log("Bugzilla Error Code: " + code);
    this.root.find(".error-message").text(error);
    this.root.find(".error-code").text("" + code);
    this.root.addClass("error");
};
BugTable.prototype.display = function (data) {
    if (data.hasOwnProperty("error") && data["error"]) {
        this.displayError(data["message"], data["code"]);
        return;
    }
    this.root.removeClass("error");
    this.data = data;
    this.makeTable();
};
BugTable.prototype.sort = function (a, b) {
    let result = 0;
    if (this.rowSort && BugTable.sorters.hasOwnProperty(this.rowSort)) {
        result = BugTable.sorters[this.rowSort](a, b);
        if (this.invertSort && result != 0) {
            result = -result;
        }
    }

    return result;
};
BugTable.prototype.sortTable = function (columnID) {
    if (columnID != this.rowSort) {
        // Our sort has changed, so default to non-inverted
        this.invertSort = false;
        this.rowSort = columnID;
    } else {
        // Same sort re-clicked - invert the sort
        this.invertSort = !this.invertSort;
    }
    this.makeTable();
};
BugTable.prototype.makeTable = function () {
    let oldTable = this.table.children(".bug-table");
    if (oldTable) {
        oldTable.remove();
    }

    if (this.data["bugs"].length == 0) {
        this.root.addClass("zarro-boogs");
        let div = $("<div />", {id: this.id, text: "Zarro Boogs!", "class": "bug-table"});
        this.table.append(div);
        return;
    }

    this.root.removeClass("zarro-boogs");
    this.root.find("#bug-count-" + this.id).text("" + this.data["bugs"].length);

    let table = $("<table />", {id: this.id, "class": "bug-table"});
    let thead = $("<thead />", {id: "thead-" + this.id, "class": "bug-table-head"});
    let thr = $("<tr />", {id: "thead-tr-" + this.id, "class": "bug-table-row"});
    let idHead = $("<th />", {text: "Bug ID", id: "thead-id-" + this.id, "class": "bug-id sortable"});
    idHead.click($.proxy(this, "sortTable", "id"));
    thr.append(idHead);
    let sevHead = $("<th />", {text: "Severity", id: "thead-severity-" + this.id, "class": "bug-severity sortable"});
    sevHead.click($.proxy(this, "sortTable", "severity"));
    thr.append(sevHead);
    thr.append($("<th />", {text: "Summary", id: "thead-summary-" + this.id, "class": "bug-summary"}));
    let self = this;
    for (let columnID of this.extraColumns) {
        let columnTitle = BugTable.columnTitles[columnID];
        let columnHead = $("<th />", {text: columnTitle, id: "thead-" + columnID + "-" + this.id, "class": "bug-" + columnID});
        if (BugTable.sorters.hasOwnProperty(columnID)) {
            columnHead.click($.proxy(this, "sortTable", columnID));
            columnHead.addClass("sortable");
        }
        thr.append(columnHead);
    }
    thead.append(thr);
    table.append(thead);

    this.data["bugs"].sort($.proxy(this, "sort"));

    let tbody = $("<tbody />", {id: "tbody-" + this.id, "class": "bug-table-body"});
    $.each(this.data["bugs"], function (i, rowData) {
        let idPrefix = "tr-" + i + "-";
        let tr = $("<tr />", {id: idPrefix + self.id, "class": "bug-table-row"});

        let icon = "ui-icon-blank";
        for (let group of rowData["groups"]) {
            // NWGH - there may be other groups here that should be called out
            // but for now, these are the only ones I know about.
            if (group == "network-core-security" ||
                group == "core-security") {
                icon = "ui-icon-locked";
            }
        }
        let idTd = $("<td />", {id: idPrefix + "id-" + self.id, "class": "bug-id"});
        let iconSpan = $("<span />", {"class": "ui-icon " + icon});
        idTd.append(iconSpan);
        let href = self.triage.settings.get("testing-only-bugzilla-origin") + "/show_bug.cgi?id=" + rowData["id"];
        let link = $("<a />", {href: href, text: "" + rowData["id"], id: idPrefix + "a-" + self.id, "class": "bug-link"});
        if (self.triage.settings.get("open-bugs-in-new-window")) {
            link.attr("target", "_blank");
        }
        if (self.triage.settings.get("modally-edit-bugs")) {
            link._BugView = new BugView(rowData["id"], self);
            link.click($.proxy(link._BugView, "view"));
        }
        idTd.append(link);
        tr.append(idTd);

        let severityTd = $("<td />", {text: rowData["severity"], id: idPrefix + "severity-" + self.id, "class": "bug-severity"});
        tr.append(severityTd);

        let summaryTd = $("<td />", {text: rowData["summary"], id: idPrefix + "summary-" + self.id, "class": "bug-summary"});
        tr.append(summaryTd);

        for (let columnID of self.extraColumns) {
            let td = $("<td />", {id: idPrefix + columnID + "-" + self.id, "class": "bug-" + columnID});
            if (BugTable.formatters.hasOwnProperty(columnID)) {
                let rowInfo = BugTable.formatters[columnID](rowData);
                if ($.type(rowInfo) == "object") {
                    // Selector returned a created element, put it in our td.
                    td.append(rowInfo);
                } else {
                    // Selector returned some plain text
                    td.text(rowInfo);
                }
            } else {
                td.text(rowData[k]);
            }

            tr.append(td);
        }

        tbody.append(tr);
    });

    table.append(tbody);

    this.table.append(table);
};
BugTable.prototype.enableFunctionality = function () {
    this.root.removeClass("loading");
    this.root.off("click");
};
BugTable.prototype.disableFunctionality = function () {
    this.root.click(function (e) {e.preventDefault();});
    this.root.addClass("loading");
};
BugTable.prototype.load = function () {
    this.disableFunctionality();

    let apiKey = this.triage.settings.get("bz-apikey");
    let query = $.extend({}, this.query);
    if (apiKey) {
        $.extend(query, {"api_key": apiKey});
    }
    $.getJSON({url: this.triage.settings.get("testing-only-bugzilla-origin") + "/rest/bug",
               data: query,
               type: "GET",
               traditional: true})
             .done($.proxy(this, "display"))
             .fail($.proxy(this, "xhrError"))
             .always($.proxy(this, "enableFunctionality"));
};
BugTable.prototype.create = function () {
    // Build up our DOM objects, and stick them in the appropriate container
    let classString = "bug-container";
    if (this.isUser) {
        classString += " user-table";
    }
    this.root = $("<div />", {"id": "bug-container-" + this.id, "class": classString});

    let errorContainer = $("<div />", {"class": "bug-error"});
    errorContainer.text("Error loading from bugzilla. Data may be stale.");
    let bzDiv = $("<div />");
    bzDiv.html("<span class=\"error-message\"></span> (<span class=\"error-code\"></span>)");
    errorContainer.append(bzDiv);
    this.root.append(errorContainer);

    let titleWrapper = $("<div />");
    let title = $("<span />", {text: this.title, "class": "bug-table-title"});
    titleWrapper.append(title);

    let countPrefix = $("<span />", {text: " (", "class": "bug-count-prefix"});
    titleWrapper.append(countPrefix);
    let countWrapper = $("<span />", {"class": "bug-count"});
    let countHTML = "<span id=\"bug-count-" + this.id + "\"></span> bugs";
    countWrapper.html(countHTML);
    titleWrapper.append(countWrapper);
    let countPostfix = $("<span />", {text: ")", "class": "bug-count-postfix"});
    titleWrapper.append(countPostfix);

    this.reloadSpan = $("<span />", {"class": "reload-button ui-icon ui-icon-arrowrefresh-1-e", title: "Reload Table"});
    this.reloadSpan.click($.proxy(this, "load"));

    titleWrapper.append(this.reloadSpan);
    this.root.append(titleWrapper);

    this.table = $("<div />", {"id": this.id});
    this.root.append(this.table);

    this.triage.rootElement.append(this.root);

    let tabClassString = "bug-tab";
    if (this.isUser) {
        classString += " user-table-tab";
    }
    let tab = $("<li />", {id: "bug-tab-" + this.id, "class": tabClassString});
    let a = $("<a />", {href: "#bug-container-" + this.id, text: this.title});
    tab.append(a);
    $("#necko-triage-tabs").append(tab);

    this.load();
};
