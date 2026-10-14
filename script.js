const components = {
    database: {
        name: "Database",
        dependencies: []
    },
    payment: {
        name: "Payment",
        dependencies: ["database"]
    },
    order: {
        name: "Order Service",
        dependencies: ["payment"]
    },
    checkout: {
        name: "Checkout",
        dependencies: ["order"]
    },
    app: {
        name: "Shopping App",
        dependencies: ["checkout"]
    }
};

let failedComponents = new Set();
let backupEnabled = false;
let selectedComponent = "payment";

const nodes = document.querySelectorAll(".node");
const edges = document.querySelectorAll(".edge");
const componentSelect = document.getElementById("componentSelect");
const failBtn = document.getElementById("failBtn");
const resetBtn = document.getElementById("resetBtn");
const backupToggle = document.getElementById("backupToggle");

const totalCount = document.getElementById("totalCount");
const operationalCount = document.getElementById("operationalCount");
const failedCount = document.getElementById("failedCount");
const healthValue = document.getElementById("healthValue");
const healthLabel = document.getElementById("healthLabel");
const healthBar = document.getElementById("healthBar");
const message = document.getElementById("message");
const eventLog = document.getElementById("eventLog");

totalCount.textContent = Object.keys(components).length;

function addEvent(title, description, type = "green") {
    const event = document.createElement("div");
    event.className = "event";

    const dot = document.createElement("span");
    dot.className = `event-dot ${type}`;

    const content = document.createElement("div");

    const heading = document.createElement("strong");
    heading.textContent = title;

    const detail = document.createElement("p");
    detail.textContent = description;

    content.append(heading, detail);
    event.append(dot, content);
    eventLog.prepend(event);
}

function getAffectedComponents(componentId) {
    const affected = new Set();
    const queue = [componentId];

    while (queue.length > 0) {
        const current = queue.shift();

        Object.entries(components).forEach(([id, component]) => {
            if (
                component.dependencies.includes(current) &&
                !affected.has(id)
            ) {
                affected.add(id);
                queue.push(id);
            }
        });
    }

    return affected;
}

function getEffectiveFailures() {
    const effective = new Set(failedComponents);

    // Database failure affects Payment and downstream services.
    // A payment backup can protect downstream services from
    // a Payment-only failure, but cannot replace the Database.
    if (backupEnabled && failedComponents.has("payment")) {
        effective.delete("payment");
    }

    const queue = [...effective];

    while (queue.length > 0) {
        const current = queue.shift();

        Object.entries(components).forEach(([id, component]) => {
            if (
                component.dependencies.includes(current) &&
                !effective.has(id)
            ) {
                effective.add(id);
                queue.push(id);
            }
        });
    }

    return effective;
}

function updateMessage(text, type = "") {
    message.textContent = text;
    message.className = "message";

    if (type) {
        message.classList.add(type);
    }
}

function render() {
    const effectiveFailures = getEffectiveFailures();
    const total = Object.keys(components).length;
    const failed = effectiveFailures.size;
    const operational = total - failed;
    const health = Math.round((operational / total) * 100);

    nodes.forEach(node => {
        const id = node.dataset.node;
        const status = node.querySelector("small");

        node.classList.toggle(
            "failed",
            effectiveFailures.has(id)
        );

        node.classList.toggle(
            "selected",
            id === selectedComponent
        );

        status.textContent = effectiveFailures.has(id)
            ? "Failed"
            : "Operational";
    });

    edges.forEach(edge => {
        const from = edge.dataset.from;
        const to = edge.dataset.to;

        edge.classList.toggle(
            "active",
            effectiveFailures.has(from) ||
            effectiveFailures.has(to)
        );
    });

    operationalCount.textContent = operational;
    failedCount.textContent = failed;
    healthValue.textContent = `${health}%`;
    healthLabel.textContent = `${health}%`;
    healthBar.style.width = `${health}%`;

    healthBar.style.background =
        health <= 40
            ? "#fb7185"
            : health <= 80
                ? "#fbbf24"
                : "#34d399";

    healthLabel.style.color =
        health <= 40
            ? "#fb7185"
            : health <= 80
                ? "#fbbf24"
                : "#34d399";

    failBtn.textContent = failedComponents.has(selectedComponent)
        ? "✓ Restore Component"
        : "⚡ Inject Failure";

    failBtn.classList.toggle(
        "secondary",
        failedComponents.has(selectedComponent)
    );

    failBtn.classList.toggle(
        "danger",
        !failedComponents.has(selectedComponent)
    );
}

function selectComponent(id) {
    selectedComponent = id;
    componentSelect.value = id;

    const node = document.querySelector(
        `.node[data-node="${id}"]`
    );

    const effectiveFailures = getEffectiveFailures();

    if (effectiveFailures.has(id)) {
        updateMessage(
            `${components[id].name} is currently affected by a failure.`,
            "error"
        );
    } else {
        updateMessage(
            `${components[id].name} is operational and ready for simulation.`,
            "success"
        );
    }

    render();
}

nodes.forEach(node => {
    node.addEventListener("click", () => {
        selectComponent(node.dataset.node);
    });
});

componentSelect.addEventListener("change", event => {
    selectComponent(event.target.value);
});

failBtn.addEventListener("click", () => {
    const id = selectedComponent;
    const name = components[id].name;

    if (failedComponents.has(id)) {
        failedComponents.delete(id);

        addEvent(
            "Component restored",
            `${name} was manually restored.`,
            "green"
        );

        updateMessage(`${name} has been restored.`, "success");
    } else {
        failedComponents.add(id);

        const affected = getAffectedComponents(id);

        addEvent(
            "Failure injected",
            `${name} failed. ${affected.size} downstream component(s) depend on it.`,
            "red"
        );

        if (backupEnabled && id === "payment") {
            updateMessage(
                "Payment failed, but backup protection keeps dependent services operational.",
                "success"
            );
        } else {
            updateMessage(
                `${name} failed. Connected dependent services may also fail.`,
                "error"
            );
        }
    }

    render();
});

backupToggle.addEventListener("change", event => {
    backupEnabled = event.target.checked;

    addEvent(
        backupEnabled ? "Backup enabled" : "Backup disabled",
        backupEnabled
            ? "Payment backup protection is active."
            : "Payment backup protection is inactive.",
        backupEnabled ? "green" : "yellow"
    );

    updateMessage(
        backupEnabled
            ? "Payment backup is enabled. It protects against a Payment-only failure."
            : "Payment backup is disabled.",
        backupEnabled ? "success" : ""
    );

    render();
});

resetBtn.addEventListener("click", () => {
    failedComponents.clear();
    backupEnabled = false;
    backupToggle.checked = false;

    selectedComponent = "payment";
    componentSelect.value = "payment";

    eventLog.replaceChildren();

    addEvent(
        "System reset",
        "All components have returned to their initial state.",
        "green"
    );

    updateMessage(
        "All components are operational.",
        "success"
    );

    render();
});

render();