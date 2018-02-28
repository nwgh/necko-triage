var triage = null;

NeckoTriage = function () { };
NeckoTriage.prototype.tables = {};
NeckoTriage.prototype.rootElement = "#necko-triage-root";
NeckoTriage.prototype.version = "0.0.1";
NeckoTriage.prototype.availableTables = {
    "untriaged-no-ni": {
        "title": "Untriaged bugs (without ni?)",
        "query": {
            "f0": "OP",
            "f1": "OP",
            "f2": "flagtypes.name",
            "f3": "CP",
            "f4": "CP",
            "status_whiteboard": "\\[necko-triaged\\]|\\[necko-active\\]|\\[necko-next\\]|\\[necko-backlog\\]|\\[necko-would-take\\]",
            "status_whiteboard_type": "notregexp",
            "component": [
                "Networking",
                "Networking: Cache",
                "Networking: Cookies",
                "Networking: DNS",
                "Networking: Domain Lists",
                "Networking: File",
                "Networking: FTP",
                "Networking: HTTP",
                "Networking: JAR",
                "Networking: WebSockets"
            ],
            "j1": "OR",
            "product": "Core",
            "v2": "needinfo?",
            "n2": "1",
            "resolution": "---",
            "o2": "substring"
        }
    },
    "untriaged-ni": {
        "title": "Untriaged bugs (awaiting ni?)",
        "query": {
            "status_whiteboard": "\\[necko-triaged\\]",
            "product": "Core",
            "query_format": "advanced",
            "status_whiteboard_type": "notregexp",
            "component": [
                "Networking",
                "Networking: Cache",
                "Networking: Cookies",
                "Networking: DNS",
                "Networking: Domain Lists",
                "Networking: File",
                "Networking: FTP",
                "Networking: HTTP",
                "Networking: JAR",
                "Networking: WebSockets"
            ],
            "f1": "flagtypes.name",
            "v1": "needinfo?",
            "resolution": "---",
            "o1": "substring",
            "priority": "--"
        }
    },
    "malformed": {
        "title": "Malformed bugs",
        "query": {
            "status_whiteboard_type": "regexp",
            "product": "Core",
            "query_format": "advanced",
            "status_whiteboard": "\\[necko-triaged\\]|\\[necko-backlog\\]|\\[necko-would-take\\]|\\[necko-active\\]|\\[necko-next\\]",
            "bug_status": [
                "UNCONFIRMED",
                "NEW",
                "ASSIGNED",
                "REOPENED"
            ],
            "component": [
                "Networking",
                "Networking: Cache",
                "Networking: Cookies",
                "Networking: DNS",
                "Networking: Domain Lists",
                "Networking: File",
                "Networking: FTP",
                "Networking: HTTP",
                "Networking: JAR",
                "Networking: WebSockets"
            ],
            "priority": "--",
            "resolution": "---"
        }
    },
    "p1-unassigned": {
        "title": "Unassigned P1 bugs",
        "query": {
            "f1": "assigned_to",
            "product": "Core",
            "query_format": "advanced",
            "component": [
                "Networking",
                "Networking: Cache",
                "Networking: Cookies",
                "Networking: DNS",
                "Networking: Domain Lists",
                "Networking: File",
                "Networking: FTP",
                "Networking: HTTP",
                "Networking: JAR",
                "Networking: WebSockets"
            ],
            "priority": "P1",
            "resolution": "---",
            "o1": "isempty"
        }
    }
};
NeckoTriage.prototype.init = function () {
    // Make sure we display the proper version info
    $("#necko-triage-version").text(this.version);

    // Give ourselves a handle to the element, not just its id
    this.rootElement = $(this.rootElement);

    // Now load all the tables
    let self = this;
    $.each(this.availableTables, function (k, v) {
        self.tables[k] = new BugTable(k, v["title"], v["query"], self);
        self.tables[k].create();
    });
};
NeckoTriage.prototype.reloadAll = function () {
    $.each(this.tables, function (k, table) {
        table.load();
    });
};

BugTable = function (id, title, query, triage) {
    this.id = id;
    this.title = title;
    this.query = query;
    this.triage = triage;
};
BugTable.prototype.id = "";
BugTable.prototype.title = "";
BugTable.prototype.query = {};
BugTable.prototype.triage = null;
BugTable.prototype.table = null;
BugTable.prototype.errorContainer = null;
BugTable.prototype.reloadSpan = null;
BugTable.prototype.showError = function () {
    this.errorContainer.text("Error loading bugs. Data may be stale.");
    this.errorContainer.show();
};
BugTable.prototype.xhrError = function (xhr, status, errorThrown) {
    console.log("Error: " + errorThrown);
    console.log("Status: " + status);
    console.log(xhr);
};
BugTable.prototype.displayError = function (error) {
    console.log("Bugzilla Error: " + error);
    this.showError();
};
BugTable.prototype.display = function (data) {
    this.errorContainer.hide();

    /* TODO - this doesn't work
    let oldTable = $(this.id);
    if (oldTable) {
        oldTable.remove();
    }
    */

    if (data["bugs"].length == 0) {
        let div = $("<div />", {id: this.id, text: "Zarro Boogs!"});
        this.table.append(div);
        return;
    }

    let table = $("<table />", {id: this.id});
    let thead = $("<thead />", {id: "thead-" + this.id});
    let thr = $("<tr />", {id: "thead-tr-" + this.id});
    thr.append($("<th />", {text: "Bug ID", id: "thead-id-" + this.id}));
    thr.append($("<th />", {text: "Summary", id: "thead-summary-" + this.id}));
    thead.append(thr);
    table.append(thead);

    let tbody = $("<tbody />", {id: "tbody-" + this.id});
    $.each(data["bugs"], function (i, rowData) {
        let idPrefix = "tr-" + i + "-";
        let tr = $("<tr />", {id: idPrefix + this.id});

        let idTd = $("<td />", {id: idPrefix + "id-" + this.id});
        let href = "https://bugzilla.mozilla.org/show_bug.cgi?id=" + rowData["id"];
        let link = $("<a />", {href: href, text: "" + rowData["id"], id: idPrefix + "a-" + this.id});
        idTd.append(link);
        tr.append(idTd);

        let summaryTd = $("<td />", {text: rowData["summary"], id: idPrefix + "summary-" + this.id});
        tr.append(summaryTd);

        tbody.append(tr);
    });

    table.append(tbody);

    this.table.append(table);
};
BugTable.prototype.enableReload = function () {
    // TODO
    //this.reloadSpan.enable();
};
BugTable.prototype.load = function () {
    //TODO
    //this.reloadSpan.disable();
    // disable table, as well
    // show spinner?
    $.getJSON({url: "https://bugzilla.mozilla.org/rest/bug",
               data: this.query, // TODO - auth param from triage
               type: "GET",
               traditional: true})
             .done($.proxy(this, "display"))
             .fail($.proxy(this, "xhrError"))
             .always($.proxy(this, "enableReload"));
};
BugTable.prototype.create = function () {
    // Build up our DOM objects, and stick them in the appropriate container
    let rootContainer = $("<div />", {"id": "bug-container-" + this.id});

    let title = $("<h1 />", {text: this.title, "class": "bug-table-title"});
    rootContainer.append(title);

    /* TODO - this doesn't work
    this.reloadSpan = $("<span>Reload</span>");
    this.reloadSpan.click($.proxy(this, "load"));
    rootContainer.append(this.reloadSpan);
    */

    this.errorContainer = $("<div />", {"class": "bug-error"});
    rootContainer.append(this.errorContainer);

    this.table = $("<div />", {"id": this.id});
    rootContainer.append(this.table);

    this.triage.rootElement.append(rootContainer);

    this.load();
};

$(function () {
    triage = new NeckoTriage();
    triage.init();
});
