(() => {
    "use strict";

    const USERS_KEY = "portal.users.v1";
    const SESSION_KEY = "portal.session.v1";

    const page = document.body.dataset.page;

    document.addEventListener("DOMContentLoaded", () => {
        bindLogoutButtons();

        if (page === "login") {
            bootLoginPage();
            return;
        }

        if (page === "register") {
            bootRegisterPage();
            return;
        }

        if (page === "dashboard") {
            bootDashboardPage();
        }
    });

    function bootLoginPage() {
        const activeSession = getSession();
        if (activeSession) {
            if (getCurrentUser()) {
                redirectTo("dashboard.html");
                return;
            }

            clearSession();
        }

        const form = document.getElementById("loginForm");
        const message = document.getElementById("loginMessage");
        const forgotPasswordLink = document.getElementById("forgotPasswordLink");

        forgotPasswordLink?.addEventListener("click", (event) => {
            event.preventDefault();
            showMessage(
                message,
                "This demo stores credentials locally. Use the password you registered with on this browser.",
                "success"
            );
        });

        form?.addEventListener("submit", (event) => {
            event.preventDefault();

            const identifier = document.getElementById("loginIdentifier").value.trim();
            const password = document.getElementById("loginPassword").value;
            const remember = document.getElementById("rememberMe").checked;

            if (!identifier || !password) {
                showMessage(message, "Enter both your username/email and password.", "error");
                return;
            }

            const users = readUsers();
            const user = users.find((entry) => matchesIdentifier(entry, identifier));

            if (!user || user.password !== password) {
                showMessage(message, "Invalid login details. Try again.", "error");
                return;
            }

            const loginAt = new Date().toISOString();
            user.lastLoginAt = loginAt;
            writeUsers(users);

            saveSession({
                userId: user.id,
                remember,
                loginAt
            });

            showMessage(message, "Login successful. Redirecting to dashboard...", "success");
            window.setTimeout(() => redirectTo("dashboard.html"), 700);
        });
    }

    function bootRegisterPage() {
        const activeSession = getSession();
        if (activeSession) {
            if (getCurrentUser()) {
                redirectTo("dashboard.html");
                return;
            }

            clearSession();
        }

        const form = document.getElementById("registerForm");
        const message = document.getElementById("registerMessage");

        form?.addEventListener("submit", (event) => {
            event.preventDefault();

            const name = document.getElementById("registerName").value.trim();
            const username = document.getElementById("registerUsername").value.trim();
            const email = document.getElementById("registerEmail").value.trim();
            const password = document.getElementById("registerPassword").value;
            const confirmPassword = document.getElementById("registerConfirmPassword").value;

            if (!name || !username || !email || !password || !confirmPassword) {
                showMessage(message, "Complete every field before submitting.", "error");
                return;
            }

            if (!isValidEmail(email)) {
                showMessage(message, "Enter a valid email address.", "error");
                return;
            }

            if (password.length < 6) {
                showMessage(message, "Password must be at least 6 characters long.", "error");
                return;
            }

            if (password !== confirmPassword) {
                showMessage(message, "Passwords do not match.", "error");
                return;
            }

            const users = readUsers();
            const usernameTaken = users.some((entry) => entry.username.toLowerCase() === username.toLowerCase());
            const emailTaken = users.some((entry) => entry.email.toLowerCase() === email.toLowerCase());

            if (usernameTaken) {
                showMessage(message, "That username is already registered.", "error");
                return;
            }

            if (emailTaken) {
                showMessage(message, "That email address is already registered.", "error");
                return;
            }

            const registeredAt = new Date().toISOString();
            const user = {
                id: createId(),
                name,
                username,
                email,
                password,
                joinedAt: registeredAt,
                lastLoginAt: registeredAt,
                tasks: []
            };

            users.push(user);
            writeUsers(users);

            saveSession({
                userId: user.id,
                remember: true,
                loginAt: registeredAt
            });

            showMessage(message, "Account created. Redirecting to dashboard...", "success");
            form.reset();
            window.setTimeout(() => redirectTo("dashboard.html"), 700);
        });
    }

    function bootDashboardPage() {
        const session = getSession();
        if (!session) {
            redirectTo("index.html");
            return;
        }

        const user = getCurrentUser();
        if (!user) {
            clearSession();
            redirectTo("index.html");
            return;
        }

        populateDashboard(user, session);
        bindTaskForm();
        bindTaskList();
        bindClearCompleted();
        renderTasks(user.tasks || []);
    }

    function bindTaskForm() {
        const form = document.getElementById("taskForm");
        const input = document.getElementById("taskInput");
        const message = document.getElementById("taskMessage");

        form?.addEventListener("submit", (event) => {
            event.preventDefault();

            const user = getCurrentUser();
            const taskText = input.value.trim();
            if (!user) {
                clearSession();
                redirectTo("index.html");
                return;
            }

            if (!taskText) {
                showMessage(message, "Enter a task before submitting.", "error");
                return;
            }

            const nextUser = {
                ...user,
                tasks: [
                    ...(user.tasks || []),
                    {
                        id: createId(),
                        text: taskText,
                        completed: false,
                        createdAt: new Date().toISOString()
                    }
                ]
            };

            persistUser(nextUser);
            input.value = "";
            showMessage(message, "Task added.", "success");
            renderTasks(nextUser.tasks);
            populateDashboard(nextUser, getSession());
        });
    }

    function bindTaskList() {
        const taskList = document.getElementById("taskList");

        taskList?.addEventListener("click", (event) => {
            const actionButton = event.target.closest("[data-task-action]");
            if (!actionButton) {
                return;
            }

            const taskId = actionButton.dataset.taskId;
            const action = actionButton.dataset.taskAction;
            const user = getCurrentUser();

            if (!user || !taskId || !action) {
                return;
            }

            let tasks = [...(user.tasks || [])];

            if (action === "toggle") {
                tasks = tasks.map((task) =>
                    task.id === taskId ? { ...task, completed: !task.completed } : task
                );
            }

            if (action === "delete") {
                tasks = tasks.filter((task) => task.id !== taskId);
            }

            const nextUser = { ...user, tasks };
            persistUser(nextUser);
            renderTasks(tasks);
            populateDashboard(nextUser, getSession());
        });
    }

    function bindClearCompleted() {
        const button = document.getElementById("clearCompletedBtn");
        const message = document.getElementById("taskMessage");

        button?.addEventListener("click", () => {
            const user = getCurrentUser();
            if (!user) {
                return;
            }

            const remainingTasks = (user.tasks || []).filter((task) => !task.completed);
            if (remainingTasks.length === (user.tasks || []).length) {
                showMessage(message, "No completed tasks to clear.", "error");
                return;
            }

            const nextUser = { ...user, tasks: remainingTasks };
            persistUser(nextUser);
            showMessage(message, "Completed tasks removed.", "success");
            renderTasks(remainingTasks);
            populateDashboard(nextUser, getSession());
        });
    }

    function bindLogoutButtons() {
        document.querySelectorAll('[data-action="logout"]').forEach((button) => {
            button.addEventListener("click", () => {
                clearSession();
                redirectTo("index.html");
            });
        });
    }

    function populateDashboard(user, session) {
        const tasks = user.tasks || [];
        const completed = tasks.filter((task) => task.completed).length;
        const pending = tasks.length - completed;

        setText("welcomeHeading", `Welcome, ${user.name.split(" ")[0]}`);
        setText("sessionMode", session?.remember ? "Remembered Session" : "Tab Session");
        setText("profileName", user.name);
        setText("profileUsername", `@${user.username}`);
        setText("profileEmail", user.email);
        setText("profileJoined", formatDate(user.joinedAt));
        setText("profileLastLogin", formatDate(user.lastLoginAt || session?.loginAt));
        setText("totalTasks", String(tasks.length));
        setText("completedTasks", String(completed));
        setText("pendingTasks", String(pending));
    }

    function renderTasks(tasks) {
        const taskList = document.getElementById("taskList");
        const emptyState = document.getElementById("emptyState");

        if (!taskList || !emptyState) {
            return;
        }

        taskList.innerHTML = "";

        if (!tasks.length) {
            emptyState.style.display = "block";
            return;
        }

        emptyState.style.display = "none";

        tasks
            .slice()
            .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
            .forEach((task) => {
                const item = document.createElement("li");
                item.className = `task-item${task.completed ? " completed" : ""}`;

                item.innerHTML = `
                    <div class="task-main">
                        <span class="task-text">${escapeHtml(task.text)}</span>
                        <span class="task-meta">Created ${formatDate(task.createdAt)}</span>
                    </div>
                    <div class="task-actions">
                        <button class="btn btn-secondary" type="button" data-task-action="toggle" data-task-id="${task.id}">
                            ${task.completed ? "Undo" : "Complete"}
                        </button>
                        <button class="btn btn-danger" type="button" data-task-action="delete" data-task-id="${task.id}">
                            Delete
                        </button>
                    </div>
                `;

                taskList.appendChild(item);
            });
    }

    function getCurrentUser() {
        const session = getSession();
        if (!session) {
            return null;
        }

        return readUsers().find((user) => user.id === session.userId) || null;
    }

    function persistUser(nextUser) {
        const users = readUsers().map((user) => (user.id === nextUser.id ? nextUser : user));
        writeUsers(users);
    }

    function readUsers() {
        try {
            return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
        } catch (error) {
            return [];
        }
    }

    function writeUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    function getSession() {
        return readJson(localStorage, SESSION_KEY) || readJson(sessionStorage, SESSION_KEY);
    }

    function saveSession(session) {
        clearSession();

        const targetStorage = session.remember ? localStorage : sessionStorage;
        targetStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
    }

    function readJson(storage, key) {
        try {
            return JSON.parse(storage.getItem(key));
        } catch (error) {
            return null;
        }
    }

    function matchesIdentifier(user, identifier) {
        const normalized = identifier.toLowerCase();
        return user.username.toLowerCase() === normalized || user.email.toLowerCase() === normalized;
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function showMessage(element, message, type) {
        if (!element) {
            return;
        }

        element.textContent = message;
        element.className = `form-message show ${type}`;
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    function formatDate(value) {
        if (!value) {
            return "-";
        }

        const date = new Date(value);
        return new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }).format(date);
    }

    function redirectTo(path) {
        window.location.href = path;
    }

    function createId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return window.crypto.randomUUID();
        }

        return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function escapeHtml(value) {
        return value
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }
})();
