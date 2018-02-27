var triage = null;

NeckoTriage = function () { };
NeckoTriage.prototype.tables = {};
NeckoTriage.prototype.rootElement = "#necko-triage-root";
NeckoTriage.prototype.version = "0.0.1";
NeckoTriage.prototype.availableTables = {
    "untriaged-no-ni": {"title": "Untriaged bugs (without ni?)", "url": "https://bugzilla.mozilla.org/rest/bug?component=Networking&component=Networking%3A%20Cache&component=Networking%3A%20Cookies&component=Networking%3A%20DNS&component=Networking%3A%20Domain%20Lists&component=Networking%3A%20File&component=Networking%3A%20FTP&component=Networking%3A%20HTTP&component=Networking%3A%20JAR&component=Networking%3A%20WebSockets&f0=OP&f1=OP&f2=flagtypes.name&f3=CP&f4=CP&j1=OR&n2=1&o2=substring&product=Core&resolution=---&status_whiteboard=%5C%5Bnecko-triaged%5C%5D|%5C%5Bnecko-active%5C%5D|%5C%5Bnecko-next%5C%5D|%5C%5Bnecko-backlog%5C%5D|%5C%5Bnecko-would-take%5C%5D&status_whiteboard_type=notregexp&v2=needinfo%3F"},
    "untriaged-ni": {"title": "Untriaged bugs (awaiting ni?)", "url": "https://bugzilla.mozilla.org/rest/bug?priority=--&f1=flagtypes.name&o1=substring&resolution=---&status_whiteboard_type=notregexp&query_format=advanced&status_whiteboard=%5C%5Bnecko-triaged%5C%5D&v1=needinfo%3F&component=Networking&component=Networking%3A%20Cache&component=Networking%3A%20Cookies&component=Networking%3A%20DNS&component=Networking%3A%20Domain%20Lists&component=Networking%3A%20File&component=Networking%3A%20FTP&component=Networking%3A%20HTTP&component=Networking%3A%20JAR&component=Networking%3A%20WebSockets&product=Core"},
    "malformed": {"title": "Malformed bugs", "url": "https://bugzilla.mozilla.org/rest/bug?priority=--&resolution=---&status_whiteboard_type=regexp&query_format=advanced&status_whiteboard=%5C%5Bnecko-triaged%5C%5D|%5C%5Bnecko-backlog%5C%5D|%5C%5Bnecko-would-take%5C%5D|%5C%5Bnecko-active%5C%5D|%5C%5Bnecko-next%5C%5D&bug_status=UNCONFIRMED&bug_status=NEW&bug_status=ASSIGNED&bug_status=REOPENED&component=Networking&component=Networking%3A%20Cache&component=Networking%3A%20Cookies&component=Networking%3A%20DNS&component=Networking%3A%20Domain%20Lists&component=Networking%3A%20File&component=Networking%3A%20FTP&component=Networking%3A%20HTTP&component=Networking%3A%20JAR&component=Networking%3A%20WebSockets&product=Core"},
    "p1-unassigned": {"title": "Unassigned P1 bugs", "url": "https://bugzilla.mozilla.org/rest/bug?priority=P1&f1=assigned_to&o1=isempty&resolution=---&query_format=advanced&component=Networking&component=Networking%3A%20Cache&component=Networking%3A%20Cookies&component=Networking%3A%20DNS&component=Networking%3A%20Domain%20Lists&component=Networking%3A%20File&component=Networking%3A%20FTP&component=Networking%3A%20HTTP&component=Networking%3A%20JAR&component=Networking%3A%20WebSockets&product=Core"}
};
NeckoTriage.prototype.init = function () {
    // Make sure we display the proper version info
    $("#necko-triage-version").text(this.version);

    // Give ourselves a handle to the element, not just its id
    this.rootElement = $(this.rootElement);

    // Now load all the tables
    let self = this;
    $.each(this.availableTables, function (k, v) {
        self.tables[k] = new BugTable(k, v["title"], v["url"], self);
        self.tables[k].create();
    });
};
NeckoTriage.prototype.reloadAll = function () {
    $.each(this.tables, function (k, table) {
        table.load();
    });
};

BugTable = function (id, title, url, triage) {
    this.id = id;
    this.title = title;
    this.url = url;
    this.triage = triage;
};
BugTable.prototype.id = "";
BugTable.prototype.title = "";
BugTable.prototype.url = "";
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
    $.getJSON(this.url).done($.proxy(this, "display"))
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
