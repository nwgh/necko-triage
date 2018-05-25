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
