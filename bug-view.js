BugView = function(id, table) {
    this.id = id;
    this.table = table;

    this.div = $("<div />", {"class": "modal-dialog bug-view"});
    this.div.css("max-height", "" + ($(window).height() - 300) + "px");
    let self = this;
    $(window).on('resize', () => {
        let windowHeight = $(window).height();
        let overlayHeight = windowHeight - 300;
        self.div.css("max-height", "" + overlayHeight + "px");
        let commentsHeight = overlayHeight / 2;
        self.div.find(".comments").css("max-height", "" + commentsHeight + "px");
    });
    let form = $("<form />", {"class": "view-innards"});
    this.div.append(form);
    this.dialog = this.div.dialog({
        autoOpen: false,
        position: { my: "top", at: "top", of: window },
        width: $(window).width() - 100,
        modal: true,
        buttons: {
            Save: function () {
                self.save();
            }
        },
        open: function (e, u) {
            self.fixupComments();
        },
        beforeClose: function (e, u) {
            [changed, junk] = self.changed();
            if (changed && !self.saved) {
                if (!confirm("Close without saving?")) {
                    e.preventDefault();
                }
            }
        },
        close: function (e, u) {
            if (self.saved) {
                self.table.load();
                self.saved = false;
            }
            $(window).off('resize');
        }
    });
};

BugView.prototype.id = null;
BugView.prototype.table = null;
BugView.prototype.div = null;
BugView.prototype.dialog = null;
BugView.prototype.saved = false;
BugView.prototype.bug = null;
BugView.prototype.loadComments = true;

BugView.prototype.newWrapper = function () {
    let newForm = $("<form />", {"class": "view-innards"});
    $(this.div.children(".view-innards")).replaceWith(newForm);

    return newForm;
};

BugView.prototype.displayError = function(error, code) {
    console.log("Bugzilla BugView Error: " + error);
    console.log("Bugzilla BugView Error Code: " + code);

    let rootEl = this.newWrapper();
    rootEl.append($("<span />", {"class": "error-message", "text": error}));
    rootEl.append($("<span />", {"class": "error-code parenthesized", "text": "" + code}));
};

BugView.prototype.insertComponentOptions = function (select, product, chosenComponent) {
    select.options.length = 0;
    for (let i = 0; i < product["components"].length; i++) {
        let component = product["components"][i];
        select.options[i] = new Option(component, component, false, component == chosenComponent);
    }
};

BugView.prototype.setComponentOptions = function (select, product, chosenComponent) {
    if (product["components"]) {
        this.insertComponentOptions(select, product, chosenComponent);
        return;
    }

    this.dialog.addClass("loading");
    this.dialog.click((e) => {e.preventDefault();});
    let origin = triage.settings.get("testing-only-bugzilla-origin");
    let self = this;
    $.getJSON({url: origin + "/rest/product?include_fields=components&names=" + product["name"],
                type: "GET",
                traditional: true})
                .then((data) => { let components = [];
                                  let cs = data["products"][0]["components"];
                                  for (let i = 0; i < cs.length; i++) {
                                      components.push(cs[i]["name"]);
                                  }
                                  components.sort();
                                  product["components"] = components;
                                  self.insertComponentOptions(select, product, chosenComponent);
                                  self.dialog.off("click");
                                  self.dialog.removeClass("loading"); });
};

BugView.prototype.display = function (data) {
    if (data.hasOwnProperty("error") && data["error"]) {
        this.displayError(data["message"], data["code"]);
        this.loadComments = false;
        return;
    }

    this.bug = data.bugs[0];

    this.dialog.dialog("option", "title", "Bug " + this.id + " - " + this.bug.summary);

    let rootEl = this.newWrapper();

    let priWrapper = $("<div />");
    let prioritySelect = MakeSelect("priority", ["--", "P1", "P2", "P3", "P5"], this.bug.priority);
    priWrapper.append(MakeLabel(prioritySelect, "Priority"));
    priWrapper.append(prioritySelect);
    rootEl.append(priWrapper);

    // mark triaged checkbox
    let triagedWrapper = $("<div />");
    let markTriaged = MakeCheckbox("mark_triaged", "Mark bug as triaged");
    triagedWrapper.append(markTriaged);
    if (this.bug.whiteboard.indexOf("[necko-triaged]") != -1) {
        // Could happen if we're viewing, say, a "my bugs" kind of list.
        triagedWrapper.hide();
    }
    rootEl.append(triagedWrapper);

    // assignee textbox
    let assigneeID = "assignee-" + this.bug.id;
    let assigneeWrapper = $("<div />", {"id": assigneeID});
    let assignee = MakeTextbox("assigned_to", "Assignee", this.bug.assigned_to);
    assigneeWrapper.append(assignee);
    rootEl.append(assigneeWrapper);
    assignee.find("input").autocomplete({
        appendTo: assigneeID,
        minLength: 5,
        delay: 500,
        source: $.proxy(triage, "autocompleteEmail")
    });

    // ni? checkbox & textbox
    let niID = "ni-" + this.bug.id;
    let niWrapper = $("<div />", {"class": "ni", "id": niID});
    let ni = MakeCheckbox("needinfo", "Get more info");
    niWrapper.append(ni);
    let requestee = MakeTextbox("requestee", "from", "");
    requestee.hide();
    // Hook up show/hide of requestee to checkbox change
    let niCheckbox = ni.find('input');
    niCheckbox.change((ev) => {
        if (niCheckbox.prop("checked")) {
            requestee.show();
            requestee.find("input").autocomplete({
                appendTo: niID,
                minLength: 5,
                delay: 500,
                source: $.proxy(triage, "autocompleteEmail")
            });
        } else {
            requestee.find("input").autocomplete("destroy");
            requestee.hide();
        }
    });
    niWrapper.append(requestee);
    rootEl.append(niWrapper);

    let pcWrapper = $("<div />", {"class": "product-component"});
    let products = triage.products;
    let productSelect = MakeSelect("product",
                                   products,
                                   this.bug.product,
                                   (x) => { return x.name; });
    pcWrapper.append(MakeLabel(productSelect, "Product"));
    pcWrapper.append(productSelect);

    pcWrapper.append(MakeLabel("component", "Component"));
    let componentSelect = MakeSelect("component", []);
    pcWrapper.append(componentSelect);
    for (let i = 0; i < products.length; i++) {
        let chosenComponent = undefined;
        if (products[i].name == this.bug.product) {
            chosenComponent = this.bug.component;
            this.setComponentOptions(componentSelect[0], products[i], chosenComponent);
            break;
        }
    }

    // Attach change listener to change available options
    let self = this;
    productSelect.change((ev) => {
        for (let i = 0; i < products.length; i++) {
            if (products[i].name == productSelect.val()) {
                if (products[i].name == this.bug.product) {
                    self.setComponentOptions(componentSelect[0], products[i], this.bug.component);
                } else {
                    self.setComponentOptions(componentSelect[0], products[i]);
                }
                break;
            }
        }
    });
    rootEl.append(pcWrapper);

    // status dropdown
    let srWrapper = $("<div />", {"class": "status-resolution"});
    let status = MakeSelect("status", triage.statuses, this.bug.status);
    srWrapper.append(MakeLabel(status, "Status"));
    srWrapper.append(status);
    // resolution dropdown
    let resWrapper = $("<span />");
    let resolution = MakeSelect("resolution", triage.resolutions, this.bug.resolution);
    resWrapper.append(MakeLabel(resolution, "Resolution"));
    resWrapper.append(resolution);
    if (status.val() != "RESOLVED" && status.val() != "VERIFIED") {
        resWrapper.hide();
    }
    srWrapper.append(resWrapper);
    // Hook up status dropdown to show/hide resolution as appropriate
    status.change((ev) => {
        if (status.val() == "RESOLVED" || status.val() == "VERIFIED") {
            resWrapper.show();
        } else {
            resWrapper.hide();
        }
    });
    rootEl.append(srWrapper);

    // comments
    let comments = $("<div />", {"class": "comments"});
    let commentsHeight = ($(window).height() - 300) / 2;
    comments.css("max-height", "" + commentsHeight + "px");
    rootEl.append(comments);

    // new comment textarea
    rootEl.append($("<textarea />", {"name": "comment"}));
};

BugView.prototype.xhrError = function (xhr, status, errorThrown) {
    console.log("BugView status: " + status);
    console.log("BugView errorThrown: " + errorThrown);
    console.log(xhr);

    this.loadComments = false;

    this.dialog.dialog("option", "title", "Error");

    let errorDiv = $("<div />", {"class": "error bug-error"});

    let baseText = $("<div />", {text: "Error loading bug " + this.id});
    errorDiv.append(baseText);

    let statusText = $("<div />", {text: "Status: " + status});
    errorDiv.append(statusText);

    let errorText = $("<div />", {text: "Error: " + errorThrown});
    errorDiv.append(errorText);

    let rootEl = this.newWrapper();
    rootEl.append(errorDiv);

    this.bug = null;
};

BugView.prototype.finishView = function () {
    this.saved = false; // Just in case
    this.dialog.dialog("open");
};

BugView.prototype.fixupComments = function () {
    // The rest of the hack started below in commentsReady. This is called from
    // the open event handler of the dialog.
    let comments = this.div.find(".comments textarea");
    comments.each((i, e) => {
        let elem = $(e)
        elem.css("height", "" + elem.prop("scrollHeight") + "px");
    });
};

BugView.prototype.commentsReady = function (data) {
    let commentData = data["bugs"][this.id]["comments"];
    let comments = this.div.find(".comments");

    for (var i = 0; i < commentData.length; i++) {
        let wrap = $("<div />", {"class": "comment"});
        let text = $("<textarea />", {text: commentData[i]["text"], "readonly": true});
        // This is a hack to make the textarea the full height of the comment.
        // The rest of the hack is in the fixupComments above.
        text.css("height", "1px");
        wrap.append(text);
        let meta = $("<div />");
        meta.append($("<span />", {"class": "author", text: commentData[i]["author"]}));
        meta.append($("<span />", {"class": "date", text: FormatDate(commentData[i]["time"])}));
        wrap.append(meta);
        comments.append(wrap);
    }
};

BugView.prototype.commentsFailed = function (xhr, status, errorThrown) {
    console.log("BugView comments status: " + status);
    console.log("BugView comments errorThrown: " + errorThrown);
    console.log(xhr);

    let comments = this.div.find(".comments");
    comments.text("Error loading comments");
};

BugView.prototype.loadData = async function() {
    this.loadComments = true; // Will get set to false if main load fails

    let query = {"api_key": triage.settings.get("bz-apikey")};
    let bugUrl = triage.settings.get("testing-only-bugzilla-origin") + "/rest/bug/" + this.id;
    await $.getJSON({url: bugUrl,
               data: query,
               type: "GET",
               traditional: true})
            .done($.proxy(this, "display"))
            .fail($.proxy(this, "xhrError")).promise();

    if (this.loadComments) {
        let commentUrl = triage.settings.get("testing-only-bugzilla-origin") + "/rest/bug/" + this.id + "/comment";
        await $.getJSON({url: commentUrl,
                   data: query,
                   type: "GET",
                   traditional: true})
                .done($.proxy(this, "commentsReady"))
                .fail($.proxy(this, "commentsFailed"));
    }

    this.finishView();
};

BugView.prototype.view = function () {
    this.bug = null;
    this.loadData();

    // Prevent link from being followed
    return false;
};

BugView.prototype.changed = function () {
    if (!this.bug) {
        // Didn't have any data, so nothing could change!
        return [false, {}];
    }

    let changedInputs = {};

    // Priority changed?
    let priority = this.div.find("[name='priority']");
    if (priority.val() === undefined) {
        console.log("Missing priority?!");
    } else if (priority.val() != this.bug.priority) {
        changedInputs["priority"] = priority.val();
    }

    // Product changed?
    let product = this.div.find("[name='product']");
    if (product.val() === undefined) {
        console.log("Missing product?!");
    } else if (product.val() != this.bug.product) {
        // Product changed
        changedInputs["product"] = product.val();
    }

    // Component changed?
    let component = this.div.find("[name='component']");
    if (component.val() === undefined) {
        console.log("Missing component?!");
    } else if (component.val() != this.bug.component || product.val() != this.bug.product) {
        // Component changed (it counts as changed if the product changed, as
        // two products may have components with the same name - i.e. "General").
        changedInputs["component"] = component.val();
    }

    // Status changed?
    let status = this.div.find("[name='status']");
    if (status.val() === undefined) {
        console.log("Missing status?!");
    } else if (status.val() != this.bug.status) {
        // Status changed
        changedInputs["status"] = status.val();
    }

    // Resolution changed? (Only matters if status has a resolution)
    if (status.val() == "RESOLVED" || status.val() == "VERIFIED") {
        let resolution = this.div.find("[name='resolution']");
        if (resolution.val() === undefined) {
            console.log("Missing resolution?!");
        } else if (resolution.val() != this.bug.resolution) {
            // Resolution changed
            changedInputs["resolution"] = resolution.val();
        }
    }

    // ni? checked?
    let needinfo = this.div.find("[name='needinfo']");
    if (needinfo.val() === undefined) {
        console.log("Missing ni?!");
    } else if (needinfo.prop("checked")) {
        let requestee = this.div.find("[name='requestee']");
        if (requestee.val() !== undefined) {
            requestee = $.trim(requestee.val());
            if (requestee) {
                changedInputs["flags"] = [{"name": "needinfo", "status": "?",
                                           "requestee": requestee, "new": true}];
            } else {
                console.log("Empty requestee")
            }
        } else {
            console.log("Missing requestee?!");
        }
    }

    // mark triaged checked && whiteboard doesn't contain necko-triaged?
    let mark_triaged = this.div.find("[name='mark_triaged']");
    if (mark_triaged.val() === undefined) {
        console.log("Missing triaged?!");
    } else if (mark_triaged.prop("checked")) {
        if (this.bug.whiteboard.indexOf("[necko-triaged]") == -1) {
            changedInputs["whiteboard"] = this.bug.whiteboard + "[necko-triaged]";
        }
    }

    // assignee changed?
    let assigned_to = this.div.find("[name='assigned_to']");
    if (assigned_to.val() === undefined) {
        console.log("Missing assignee?!");
    } else if ($.trim(assigned_to.val()) != this.bug.assigned_to) {
        changedInputs["assigned_to"] = $.trim(assigned_to.val());
    }

    // new comment?
    let newComment = this.div.find("[name='comment']");
    if (newComment.val() === undefined) {
        console.log("Missing comment field?!");
    } else if ($.trim(newComment.val())) {
        changedInputs["comment"] = $.trim(newComment.val());
    }

    return [!!(Object.keys(changedInputs).length), changedInputs];
}

BugView.prototype.save = async function () {
    [changed, changedInputs] = this.changed();
    if (changed) {
        let comment;
        if (changedInputs["comment"]) {
            comment = changedInputs["comment"];
            delete changedInputs.comment;
        }

        let url = triage.settings.get("testing-only-bugzilla-origin") + "/rest/bug/" + this.id;
        let apiKey = {"api_key": triage.settings.get("bz-apikey")};

        let updateSaved = false;
        if (Object.keys(changedInputs).length) {
            let query = $.extend({}, changedInputs);
            $.extend(query, apiKey);
            await $.ajax({
                url: url,
                data: JSON.stringify(query),
                type: "PUT",
                processData: false,
                headers: {"Content-Type": "application/json"}
            }).done(() => { updateSaved = true; }).promise();
        } else {
            updateSaved = true;
        }

        let commentSaved = false;
        if (comment) {
            let query = {"comment": comment};
            $.extend(query, apiKey);
            await $.ajax({
                url: url + "/comment",
                data: query,
                type: "POST",
                traditional: true
            }).done(() => { commentSaved = true; }).promise();
        } else {
            commentSaved = true;
        }

        if (updateSaved && commentSaved) {
            this.saved = true;
        }
    } else {
        this.saved = true;
    }

    if (this.saved) {
        this.dialog.dialog("close");
    } else {
        alert('Error saving!');
    }
};
