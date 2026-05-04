const promptForm = document.querySelector(".prompt-bar");
const promptInput = document.querySelector(".prompt-bar input");
const conversation = document.querySelector(".conversation");
const refreshButton = document.querySelector("#refresh-button");
const metrics = document.querySelectorAll(".metric-card strong, .service-card strong");
const navButtons = document.querySelectorAll("[data-view-target]");
const views = document.querySelectorAll("[data-view]");
const viewEyebrow = document.querySelector("#view-eyebrow");
const viewTitle = document.querySelector("#view-title");
const primaryAction = document.querySelector("#primary-action");

const viewCopy = {
  workspace: {
    eyebrow: "MVP workspace",
    title: "Understand the architecture before changing the code.",
    action: "New analysis",
  },
  repositories: {
    eyebrow: "Repository intake",
    title: "Bring codebases into Codara and track analysis readiness.",
    action: "Upload repo",
  },
  diagrams: {
    eyebrow: "Architecture visualization",
    title: "Inspect system paths, dependencies, and design bottlenecks.",
    action: "Generate diagram",
  },
  observability: {
    eyebrow: "Monitoring and operations",
    title: "Watch service health, logs, metrics, queues, and alerts.",
    action: "Open dashboard",
  },
};

const sampleReplies = [
  "The authentication path depends on api dependencies, auth service, user model, and token validation. I would start by checking request guards before changing the service layer.",
  "The highest-risk dependency is between the analysis service and diagram generator. Splitting graph formatting from analysis output would make that boundary cleaner.",
  "For observability, expose API latency, queue depth, worker duration, vector DB ingestion rate, and analyzer failure count first.",
];

let replyIndex = 0;

function addMessage(kind, text) {
  const message = document.createElement("div");
  message.className = `message ${kind}`;
  const name = document.createElement("p");
  name.className = "message-name";
  name.textContent = kind === "user" ? "You" : "Codara";
  const body = document.createElement("p");
  body.textContent = text;
  message.append(name, body);
  conversation.appendChild(message);
  message.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setView(viewName) {
  const copy = viewCopy[viewName] || viewCopy.workspace;

  views.forEach((view) => {
    view.classList.toggle("active", view.dataset.view === viewName);
  });

  navButtons.forEach((button) => {
    const isActive = button.dataset.viewTarget === viewName;
    button.classList.toggle("active", isActive);
    if (button.classList.contains("nav-item")) {
      if (isActive) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  });

  viewEyebrow.textContent = copy.eyebrow;
  viewTitle.textContent = copy.title;
  primaryAction.textContent = copy.action;
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setView(button.dataset.viewTarget);
  });
});

if (promptForm) {
  promptForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = promptInput.value.trim();
    if (!value) return;

    addMessage("user", value);
    promptInput.value = "";

    window.setTimeout(() => {
      addMessage("assistant", sampleReplies[replyIndex % sampleReplies.length]);
      replyIndex += 1;
    }, 380);
  });
}

refreshButton.addEventListener("click", () => {
  metrics.forEach((metric) => {
    metric.animate(
      [
        { transform: "translateY(0)", opacity: 1 },
        { transform: "translateY(-4px)", opacity: 0.35 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      { duration: 420, easing: "ease-out" },
    );
  });
});
