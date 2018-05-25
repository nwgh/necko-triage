AppSettings = function () {
    let trigger = $("#settings-trigger");
    trigger.click($.proxy(this, "show"));
    let self = this;
    this.settingsDialog = $("#settings-dialog").dialog({
        autoOpen: false,
        width: 400,
        modal: true,
        buttons: {
            Close: function () {
                self.settingsDialog.dialog("close");
            }
        },
        close: function () {
            self.close();
        }
    });

    $("#custom-query-add-trigger").click($.proxy(this, "showCQAdd"));
    this.customQueryAddDialog = $("#custom-query-add").dialog({
        autoOpen: false,
        width: 375,
        modal: true,
        buttons: {
            Cancel: function () {
                self.closeCustomQueryAdd();
            },
            Save: function () {
                self.saveCustomQueryAdd();
            }
        }
    });

    let customQueriesHelp = $("#custom-queries-help-trigger");
    customQueriesHelp.click($.proxy(this, "showCQHelp"));
    this.customQueriesHelpDialog = $("#custom-queries-help").dialog({
        autoOpen: false,
        width: 350,
        modal: true,
        buttons: {
            Ok: function () {
                self.customQueriesHelpDialog.dialog("close");
            }
        }
    });

    this.load();
};
AppSettings.prototype.FIELDS = ["bz-apikey"];
AppSettings.prototype.CHECKBOXES = ["open-bugs-in-new-window", "show-tables-in-tabs"];
AppSettings.prototype._settings = {};
AppSettings.prototype.oldCustomQueries = null;
AppSettings.prototype.load = function () {
    let strSettings = window.localStorage.getItem("settings");
    if (strSettings) {
        this._settings = JSON.parse(strSettings);
    }

    for (let i of this.FIELDS) {
        if (this._settings.hasOwnProperty(i)) {
            $("#" + i).val(this._settings[i]);
        } else {
            this._settings[i] = "";
        }
    }

    for (let i of this.CHECKBOXES) {
        if (this._settings.hasOwnProperty(i)) {
            document.getElementById(i).checked = this._settings[i];
        } else {
            this._settings[i] = document.getElementById(i).checked;
        }
    }

    if (this._settings.hasOwnProperty("custom-queries")) {
        let self = this;
        $.each(this._settings["custom-queries"], function (i, query) {
            self.displayCustomQuery(i, query);
        });
    } else {
        this._settings["custom-queries"] = [];
    }
};
AppSettings.prototype.displayCustomQuery = function (i, query) {
    let rootElement = $("#custom-queries-wrapper");
    let div = $("<div />", {id: "custom-query-setting-" + i, text: query["title"], "class": "custom-query-setting"});
    let button = $("<button />", {title: "Remove Query", "class": "query-remove ui-button ui-widget ui-corner-all ui-button-icon-only"});
    button.click($.proxy(this, "removeQuery", i));
    let span = $("<span />", {"class": "ui-icon ui-icon-minus"});
    button.append(span);
    div.append(button);
    rootElement.append(div);
};
AppSettings.prototype.closeCustomQueryAdd = function () {
    // Clear out the input fields for next time
    $("#query-title").val("");
    $("#query-url").val("");

    this.customQueryAddDialog.dialog("close");
};
AppSettings.prototype.showError = function (message) {
    $("<div />", {title: "Error", text: message}).dialog({
        modal: true,
        width: 325
    });
};
AppSettings.prototype.saveCustomQueryAdd = function () {
    let queryTitle = $.trim($("#query-title").val());
    if (queryTitle == "") {
        this.showError("Title can't be empty!");
        return;
    }
    for (let query of this._settings["custom-queries"]) {
        if (queryTitle == query["title"]) {
            this.showError("Query '" + queryTitle + "' already exists!");
            return;
        }
    }

    let queryURL = $.trim($("#query-url").val());
    if (queryURL == "") {
        this.showError("URL can't be empty!");
        return;
    }

    let parsedURL = URI(queryURL);
    if (parsedURL.origin() != "https://bugzilla.mozilla.org") {
        this.showError("URL is not from BMO!");
        return;
    }
    if (parsedURL.path() != "/buglist.cgi" &&
        parsedURL.path() != "/query.cgi") {
        this.showError("URL does not appear to be search results!");
        return;
    }

    let query = parsedURL.query(true);
    if (query.hasOwnProperty("list_id")) {
        delete query.list_id;
    }
    if (query.hasOwnProperty("query_format")) {
        delete query.query_format;
    }

    if (!this.oldCustomQueries) {
        this.oldCustomQueries = Array.from(this._settings["custom-queries"]);
    }
    let newQuery = {"title": queryTitle, "query": query};
    let i = this._settings["custom-queries"].length;
    this._settings["custom-queries"].push(newQuery);
    this.displayCustomQuery(i, newQuery);

    this.closeCustomQueryAdd();
};
AppSettings.prototype.removeQuery = function (index) {
    let currentLength = this._settings["custom-queries"].length;
    if (index >= currentLength) {
        console.log("removeQuery: index too big?!");
        return;
    }
    if (index < 0) {
        console.log("removeQuery: index too small?!");
        return;
    }

    if (!this.oldCustomQueries) {
        this.oldCustomQueries = Array.from(this._settings["custom-queries"]);
    }

    this._settings["custom-queries"].splice(index, 1);
    $("#custom-query-setting-" + index).remove();

    if (index != (currentLength - 1)) {
        // Need to adjust the indices, because we removed from somewhere in
        // the middle of the list.
        let queries = document.getElementsByClassName("custom-query-setting");
        for (let i = 0; i < queries.length; i++) {
            queries[i].id = "custom-query-setting-" + i;
            let button = $(queries[i]).children("button");
            button.off("click");
            button.click($.proxy(this, "removeQuery", i));
        }
    }
};
AppSettings.prototype.show = function () {
    this.settingsDialog.dialog("open");
};
AppSettings.prototype.showCQHelp = function () {
    this.customQueriesHelpDialog.dialog("open");
};
AppSettings.prototype.showCQAdd = function () {
    this.customQueryAddDialog.dialog("open");
};
AppSettings.prototype.close = function () {
    let anySettingChanged = false;

    for (let i of this.FIELDS) {
        let newVal = $("#" + i).val();
        if (newVal != this._settings[i]) {
            anySettingChanged = true;
        }
        this._settings[i] = newVal;
    }

    for (let i of this.CHECKBOXES) {
        let newVal = document.getElementById(i).checked;
        if (newVal != this._settings[i]) {
            anySettingChanged = true;
        }
        this._settings[i] = newVal;
    }

    let resetUserTables = false;
    if (this.oldCustomQueries) {
        anySettingChanged = true;
        resetUserTables = true;
    }

    if (anySettingChanged) {
        window.localStorage.setItem("settings", JSON.stringify(this._settings));
        triage.reloadAll(resetUserTables);
    }
};
AppSettings.prototype.get = function (key) {
    if (this._settings.hasOwnProperty(key)) {
        return this._settings[key];
    }

    return undefined;
};
