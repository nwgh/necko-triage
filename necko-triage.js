NeckoTriage = function () { };
NeckoTriage.prototype.tables = {};
NeckoTriage.prototype.rootElement = "#necko-triage-root";
NeckoTriage.prototype.version = "0.0.5";
NeckoTriage.prototype.useTabs = false;
NeckoTriage.prototype.availableTables = {
    "untriaged-no-ni": {
        "is_user": false,
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
        },
        "extra_columns": {},
        "row_sort": SortBySeverity
    },
    "untriaged-ni": {
        "is_user": false,
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
        },
        "extra_columns": {"ni-date": {"title": "Last ni?", "data_selector": GetNI}},
        "row_sort": SortByNI
    },
    "malformed": {
        "is_user": false,
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
        },
        "extra_columns": {},
        "row_sort": SortBySeverity
    },
    "p1-unassigned": {
        "is_user": false,
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
        },
        "extra_columns": {},
        "row_sort": SortBySeverity
    }
};
NeckoTriage.prototype.init = function () {
    // Make sure we display the proper version info
    $("#necko-triage-version").text(this.version);

    // Give ourselves a handle to the element, not just its id
    this.rootElement = $(this.rootElement);

    this.settings = new AppSettings();
    $("#menu").menu();
    $("#reload-all").click($.proxy(this, "reloadAll", false));

    // Now load all the tables
    let self = this;
    $.each(this.availableTables, function (k, v) {
        self.tables[k] = new BugTable(k, v, self);
        self.tables[k].create();
    });

    this.createUserTables();

    // Finally, set up the tabs, now that all our DOM elements are in place
    this.useTabs = this.settings.get("show-tables-in-tabs");
    if (this.useTabs) {
        this.rootElement.tabs();
    }
};
NeckoTriage.prototype.reloadAll = function (resetUserTables) {
    // In addition to destroying our tables if the user has un-checked the box,
    // we need to destroy them (temporarily) if we're changing the list of
    // user tables. This allows jquery-ui to set the proper classes on the new
    // tables so they'll properly display as tabs.
    if (this.useTabs && (resetUserTables || !this.settings.get("show-tables-in-tabs"))) {
        this.rootElement.tabs("destroy");
    }

    if (resetUserTables) {
        $(".user-table").remove();
        $(".user-table-tab").remove();

        let newTables = {};
        $.each(this.tables, function (k, table) {
            if (!table.isUser) {
                newTables[k] = table;
            }
        });
        this.tables = newTables;
    }

    $.each(this.tables, function (k, table) {
        table.load();
    });

    if (resetUserTables) {
        this.createUserTables();
    }

    // This is the pair for the block at the top of this method - enable our tabs
    // if (1) they're newly enabled, or (2) they were enabled *and* we changed
    // the table list.
    if ((!this.useTabs && this.settings.get("show-tables-in-tabs")) ||
        (this.useTabs && resetUserTables)) {
        this.rootElement.tabs();
    }

    this.useTabs = this.settings.get("show-tables-in-tabs");
};
NeckoTriage.prototype.createUserTables = function () {
    let customQueries = this.settings.get("custom-queries");
    let self = this;
    $.each(customQueries, function (i, customQuery) {
        self.createUserTable(i, customQuery);
    });
};
NeckoTriage.prototype.createUserTable = function (index, customQuery) {
    let queryConfig = $.extend({}, customQuery);
    queryConfig["extra_columns"] = [];
    queryConfig["row_sort"] = SortBySeverity;
    queryConfig["is_user"] = true;

    let tableID = "user-query-" + index;
    this.tables[tableID] = new BugTable(tableID, queryConfig, this);
    this.tables[tableID].create();
};
