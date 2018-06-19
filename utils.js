function SortByID(a, b) {
    return a["id"] - b["id"];
}

function SortBySeverity(a, b) {
    const SeverityMap = [
        "blocker",
        "critical",
        "major",
        "normal",
        "minor",
        "trivial",
        "enhancement"
    ];
    let aSev = SeverityMap.indexOf(a["severity"]);
    let bSev = SeverityMap.indexOf(b["severity"]);

    return aSev - bSev;
}

function GetNIHelper(dataRow) {
    let lastNI = undefined;
    for (let flag of dataRow["flags"]) {
        if (flag["name"] == "needinfo") {
            lastNI = flag["modification_date"];
        }
    }

    return lastNI;
}

function SortByNI(a, b) {
    let aNI = GetNIHelper(a);
    let bNI = GetNIHelper(b);

    if (a === undefined || b === undefined) {
        // Use our default sort instead
        return SortBySeverity(a, b);
    }

    let aDate = new Date(aNI);
    let bDate = new Date(bNI);

    // We want the oldest ones first
    if (aDate < bDate) {
        return -1;
    }

    if (bDate < aDate) {
        return 1;
    }

    // Fall back to the default sort
    return SortBySeverity(a, b);
}

function GetNI(dataRow) {
    let lastNI = GetNIHelper(dataRow);

    if ($.type(lastNI) == "string") {
        let relativeLastNI = moment(lastNI).fromNow();
        let span = $("<span />", {title: lastNI, text: relativeLastNI});
        span.tooltip();
        lastNI = span;
    } else {
        lastNI = "unknown";
    }

    return lastNI;
}

function MakeSelect(name, options, selected, valueGetter) {
    let select = $("<select />", {name: name});

    for (let i = 0; i < options.length; i++) {
        let option;
        if (valueGetter !== undefined) {
            option = valueGetter(options[i]);
        } else {
            option = options[i];
        }

        let item;
        if (option == selected) {
            item = $("<option />", {"value": option, "text": option, "selected": true});
        } else {
            item = $("<option />", {"value": option, "text": option});
        }

        select.append(item);
    }

    return select;
}

function MakeLabel(node, label) {
    let nodeName;
    if (typeof node == "string") {
        nodeName = node;
    } else {
        nodeName = node.attr("name");
    }
    return $("<label />", {"for": nodeName, "text": label});
}

function MakeCheckbox(name, label) {
    let w = $("<span />", {"class": "checkbox-wrapper"});
    w.append($("<input />", {"type": "checkbox", "name": name}));
    w.append($("<label />", {"for": name, "text": label}));
    return w;
}

function MakeTextbox(name, label, value) {
    let w = $("<span />", {"class": "textbox-wrapper"});
    w.append($("<label />", {"for": name, "text": label}));
    let t = $("<input />", {"type": "text", "name": name});
    if (value !== undefined) {
        t.attr("value", value);
    }
    w.append(t);
    return w;
}

function FormatDate(dateString) {
    let d = new Date(dateString);
    return d.toLocaleString();
}
