import * as db from "./db.js";

const view = document.getElementById("view");
const topbar = document.getElementById("topbar");
let currentUser = null;
let currentProfile = null;
const unsubscribers = [];

function clearSubs() {
  unsubscribers.forEach(u => u());
  unsubscribers.length = 0;
}

function money(n) {
  return "GHS " + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// ---------------- AUTH SCREENS ----------------

function renderLogin() {
  topbar.innerHTML = "";
  view.innerHTML = `
    <section class="auth-card">
      <div class="ledger-mark">Ledger</div>
      <h1>Welcome back</h1>
      <p class="sub">Sign in to your savings book.</p>
      <form id="loginForm">
        <label>Email<input type="email" name="email" required autocomplete="email"></label>
        <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
        <button class="btn-primary" type="submit">Sign in</button>
      </form>
      <p class="switch">New here? <a href="#" id="toSignup">Open an account</a></p>
      <p class="error" id="authError"></p>
    </section>`;
  document.getElementById("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await db.logIn(f.get("email"), f.get("password"));
    } catch (err) {
      document.getElementById("authError").textContent = friendlyAuthError(err);
    }
  });
  document.getElementById("toSignup").addEventListener("click", e => { e.preventDefault(); renderSignup(); });
}

function renderSignup() {
  topbar.innerHTML = "";
  view.innerHTML = `
    <section class="auth-card">
      <div class="ledger-mark">Ledger</div>
      <h1>Open an account</h1>
      <p class="sub">Start your daily savings record.</p>
      <form id="signupForm">
        <label>Full name<input type="text" name="name" required></label>
        <label>Phone<input type="tel" name="phone" required></label>
        <label>Email<input type="email" name="email" required autocomplete="email"></label>
        <label>Password<input type="password" name="password" required minlength="6" autocomplete="new-password"></label>
        <button class="btn-primary" type="submit">Create account</button>
      </form>
      <p class="switch">Already registered? <a href="#" id="toLogin">Sign in</a></p>
      <p class="error" id="authError"></p>
    </section>`;
  document.getElementById("signupForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await db.signUp(f.get("email"), f.get("password"), f.get("name"), f.get("phone"));
    } catch (err) {
      document.getElementById("authError").textContent = friendlyAuthError(err);
    }
  });
  document.getElementById("toLogin").addEventListener("click", e => { e.preventDefault(); renderLogin(); });
}

function friendlyAuthError(err) {
  const code = err.code || "";
  if (code.includes("email-already-in-use")) return "That email already has an account.";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "Wrong email or password.";
  if (code.includes("user-not-found")) return "No account with that email.";
  if (code.includes("weak-password")) return "Password needs at least 6 characters.";
  return "Something went wrong. Try again.";
}

// ---------------- SHARED CHROME ----------------

function renderTopbar(label) {
  topbar.innerHTML = `
    <div class="topbar-inner">
      <div class="brand"><span class="ledger-mark small">Ledger</span><span class="role-pill">${label}</span></div>
      <button id="logoutBtn" class="btn-ghost">Sign out</button>
    </div>`;
  document.getElementById("logoutBtn").addEventListener("click", () => db.logOut());
}

// ---------------- ADMIN DASHBOARD ----------------

function renderAdmin() {
  renderTopbar("Admin");
  view.innerHTML = `
    <section class="dash">
      <h1>Overview</h1>
      <p class="sub">${todayLabel()}</p>
      <div class="stat-row" id="statRow"></div>

      <div class="tabs">
        <button class="tab-btn active" data-tab="customers">Customers</button>
        <button class="tab-btn" data-tab="collectors">Collectors</button>
        <button class="tab-btn" data-tab="collections">Collections</button>
        <button class="tab-btn" data-tab="withdrawals">Withdrawals</button>
      </div>
      <div id="tabBody"></div>
    </section>`;

  let customers = [], collectors = [], collections = [], withdrawals = [];

  function renderStats() {
    const totalBalance = customers.reduce((s, c) => s + Number(c.balance || 0), 0);
    const pending = withdrawals.filter(w => w.status === "pending").length;
    document.getElementById("statRow").innerHTML = `
      <div class="stat"><span class="stat-num">${customers.length}</span><span class="stat-label">Customers</span></div>
      <div class="stat"><span class="stat-num">${collectors.length}</span><span class="stat-label">Collectors</span></div>
      <div class="stat"><span class="stat-num">${money(totalBalance)}</span><span class="stat-label">Total on deposit</span></div>
      <div class="stat"><span class="stat-num">${pending}</span><span class="stat-label">Pending withdrawals</span></div>`;
  }

  function collectorName(id) { return collectors.find(c => c.id === id)?.name || "Unassigned"; }
  function customerName(id) { return customers.find(c => c.id === id)?.name || "—"; }

  const tabs = {
    customers: () => `
      <form id="newCustomerForm" class="inline-form">
        <input name="name" placeholder="Customer name" required>
        <input name="phone" placeholder="Phone" required>
        <input name="email" placeholder="Email (so they can sign in)" required>
        <select name="collectorId"><option value="">Assign collector later</option>
          ${collectors.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}</select>
        <button class="btn-primary" type="submit">Add customer</button>
      </form>
      <p class="hint">The customer signs up on the login screen using this exact email — that links their account to this record automatically.</p>
      <table class="ledger-table"><thead><tr><th>Name</th><th>Account #</th><th>Collector</th><th>Balance</th></tr></thead>
      <tbody>${customers.map(c => `
        <tr><td>${c.name}</td><td>${c.accountNumber}</td>
        <td><select data-cid="${c.id}" class="reassign">
          <option value="">Unassigned</option>
          ${collectors.map(col => `<option value="${col.id}" ${col.id === c.collectorId ? "selected" : ""}>${col.name}</option>`).join("")}
        </select></td>
        <td>${money(c.balance)}</td></tr>`).join("")}</tbody></table>`,
    collectors: () => `
      <form id="newCollectorForm" class="inline-form">
        <input name="name" placeholder="Collector name" required>
        <input name="phone" placeholder="Phone" required>
        <input name="email" placeholder="Email (so they can sign in)" required>
        <button class="btn-primary" type="submit">Add collector</button>
      </form>
      <p class="hint">The collector signs up on the login screen using this exact email — that links their account to this record automatically.</p>
      <table class="ledger-table"><thead><tr><th>Name</th><th>Phone</th><th>Customers assigned</th></tr></thead>
      <tbody>${collectors.map(c => `
        <tr><td>${c.name}</td><td>${c.phone}</td><td>${customers.filter(x => x.collectorId === c.id).length}</td></tr>`).join("")}</tbody></table>`,
    collections: () => `
      <table class="ledger-table"><thead><tr><th>Date</th><th>Receipt</th><th>Customer</th><th>Collector</th><th>Amount</th></tr></thead>
      <tbody>${collections.map(c => `
        <tr><td>${c.date}</td><td>${c.receiptNumber}</td><td>${customerName(c.customerId)}</td><td>${collectorName(c.collectorId)}</td><td>${money(c.amount)}</td></tr>`).join("") || "<tr><td colspan='5'>No collections recorded yet.</td></tr>"}</tbody></table>`,
    withdrawals: () => `
      <table class="ledger-table"><thead><tr><th>Requested</th><th>Customer</th><th>Amount</th><th>Status</th><th></th></tr></thead>
      <tbody>${withdrawals.map(w => `
        <tr><td>${w.requestedAt?.toDate ? w.requestedAt.toDate().toLocaleDateString() : "—"}</td>
        <td>${customerName(w.customerId)}</td><td>${money(w.amount)}</td>
        <td><span class="status status-${w.status}">${w.status}</span></td>
        <td>${w.status === "pending" ? `
          <button class="btn-small approve" data-id="${w.id}" data-cid="${w.customerId}" data-amt="${w.amount}">Approve</button>
          <button class="btn-small reject" data-id="${w.id}" data-cid="${w.customerId}" data-amt="${w.amount}">Reject</button>` : "—"}</td></tr>`).join("") || "<tr><td colspan='5'>No withdrawal requests.</td></tr>"}</tbody></table>`
  };

  function wireTab(name) {
    const body = document.getElementById("tabBody");
    body.innerHTML = tabs[name]();
    if (name === "customers") {
      document.getElementById("newCustomerForm").addEventListener("submit", async e => {
        e.preventDefault();
        const f = new FormData(e.target);
        await db.createCustomerByAdmin(f.get("name"), f.get("phone"), f.get("email"), f.get("collectorId"));
        e.target.reset();
      });
      body.querySelectorAll(".reassign").forEach(sel => {
        sel.addEventListener("change", () => db.assignCollector(sel.dataset.cid, sel.value || null));
      });
    }
    if (name === "collectors") {
      document.getElementById("newCollectorForm").addEventListener("submit", async e => {
        e.preventDefault();
        const f = new FormData(e.target);
        await db.createCollector(f.get("name"), f.get("phone"), f.get("email"));
        e.target.reset();
      });
    }
    if (name === "withdrawals") {
      body.querySelectorAll(".approve, .reject").forEach(btn => {
        btn.addEventListener("click", async () => {
          const approve = btn.classList.contains("approve");
          btn.closest("tr").style.opacity = "0.5";
          await db.processWithdrawal(btn.dataset.id, btn.dataset.cid, btn.dataset.amt, approve, currentUser.uid);
        });
      });
    }
  }

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      wireTab(btn.dataset.tab);
    });
  });

  unsubscribers.push(db.listCustomers(list => { customers = list; renderStats(); if (document.querySelector(".tab-btn.active")?.dataset.tab === "customers") wireTab("customers"); }));
  unsubscribers.push(db.listCollectors(list => { collectors = list; renderStats(); if (document.querySelector(".tab-btn.active")?.dataset.tab === "collectors") wireTab("collectors"); }));
  unsubscribers.push(db.listAllCollections(list => { collections = list; if (document.querySelector(".tab-btn.active")?.dataset.tab === "collections") wireTab("collections"); }));
  unsubscribers.push(db.listAllWithdrawals(list => { withdrawals = list; renderStats(); if (document.querySelector(".tab-btn.active")?.dataset.tab === "withdrawals") wireTab("withdrawals"); }));

  wireTab("customers");
}

// ---------------- COLLECTOR DASHBOARD ----------------

function renderCollector() {
  renderTopbar("Collector");
  view.innerHTML = `
    <section class="dash">
      <h1>${currentProfile.name}'s route</h1>
      <p class="sub">${todayLabel()}</p>
      <div id="collectorBody"></div>
      <h2>Recent entries</h2>
      <table class="ledger-table"><thead><tr><th>Date</th><th>Receipt</th><th>Customer</th><th>Amount</th></tr></thead>
      <tbody id="recentBody"><tr><td colspan="4">Loading…</td></tr></tbody></table>
    </section>`;

  const collectorId = currentProfile.collectorRef;
  let customers = [];

  function renderList() {
    const body = document.getElementById("collectorBody");
    if (!customers.length) {
      body.innerHTML = `<p class="empty">No customers assigned to you yet. Ask the admin to assign customers to your route.</p>`;
      return;
    }
    body.innerHTML = customers.map(c => `
      <form class="collect-row" data-cid="${c.id}">
        <div class="collect-info"><strong>${c.name}</strong><span>${c.accountNumber} · Balance ${money(c.balance)}</span></div>
        <input name="amount" type="number" min="1" step="0.01" placeholder="Amount" required>
        <button class="btn-primary btn-small" type="submit">Record</button>
      </form>`).join("");
    body.querySelectorAll(".collect-row").forEach(form => {
      form.addEventListener("submit", async e => {
        e.preventDefault();
        const amt = new FormData(form).get("amount");
        const btn = form.querySelector("button");
        btn.disabled = true; btn.textContent = "Saving…";
        const receipt = await db.recordCollection(form.dataset.cid, collectorId, amt, "");
        btn.disabled = false; btn.textContent = "Record";
        form.reset();
        flash(`Receipt ${receipt} saved.`);
      });
    });
  }

  unsubscribers.push(db.listCustomers(list => {
    customers = list.filter(c => c.collectorId === collectorId);
    renderList();
  }));

  unsubscribers.push(db.listCollectionsForCollector(collectorId, rows => {
    const byId = Object.fromEntries(customers.map(c => [c.id, c.name]));
    document.getElementById("recentBody").innerHTML = rows.slice(0, 25).map(r => `
      <tr><td>${r.date}</td><td>${r.receiptNumber}</td><td>${byId[r.customerId] || "—"}</td><td>${money(r.amount)}</td></tr>`).join("")
      || "<tr><td colspan='4'>No entries yet.</td></tr>";
  }));
}

// ---------------- CUSTOMER DASHBOARD ----------------

function renderCustomer() {
  renderTopbar("Customer");
  view.innerHTML = `
    <section class="dash">
      <div class="balance-card">
        <span class="balance-label">Available balance</span>
        <span class="balance-num" id="balanceNum">—</span>
        <span class="balance-acct" id="acctNum"></span>
      </div>

      <div class="tabs">
        <button class="tab-btn active" data-tab="history">History</button>
        <button class="tab-btn" data-tab="withdraw">Withdraw</button>
      </div>
      <div id="tabBody"></div>
    </section>`;

  const customerId = currentProfile.customerRef;
  let profile = null, collections = [], withdrawals = [];

  function renderBalance() {
    if (!profile) return;
    document.getElementById("balanceNum").textContent = money(profile.balance);
    document.getElementById("acctNum").textContent = "Account " + profile.accountNumber;
  }

  const tabs = {
    history: () => `
      <table class="ledger-table"><thead><tr><th>Date</th><th>Receipt</th><th>Amount</th></tr></thead>
      <tbody>${collections.map(c => `<tr><td>${c.date}</td><td>${c.receiptNumber}</td><td>${money(c.amount)}</td></tr>`).join("") || "<tr><td colspan='3'>No deposits recorded yet.</td></tr>"}</tbody></table>`,
    withdraw: () => `
      <form id="wForm" class="inline-form stacked">
        <label>Amount to withdraw<input name="amount" type="number" min="1" step="0.01" required></label>
        <label>Reason (optional)<input name="reason" type="text"></label>
        <button class="btn-primary" type="submit">Request withdrawal</button>
      </form>
      <h2>Your requests</h2>
      <table class="ledger-table"><thead><tr><th>Requested</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>${withdrawals.map(w => `<tr><td>${w.requestedAt?.toDate ? w.requestedAt.toDate().toLocaleDateString() : "—"}</td><td>${money(w.amount)}</td><td><span class="status status-${w.status}">${w.status}</span></td></tr>`).join("") || "<tr><td colspan='3'>No requests yet.</td></tr>"}</tbody></table>`
  };

  function wireTab(name) {
    document.getElementById("tabBody").innerHTML = tabs[name]();
    if (name === "withdraw") {
      document.getElementById("wForm").addEventListener("submit", async e => {
        e.preventDefault();
        const f = new FormData(e.target);
        const amt = Number(f.get("amount"));
        if (amt > Number(profile.balance)) { flash("Amount exceeds your balance."); return; }
        await db.requestWithdrawal(customerId, amt, f.get("reason"));
        e.target.reset();
        flash("Withdrawal request submitted.");
      });
    }
  }

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      wireTab(btn.dataset.tab);
    });
  });

  unsubscribers.push(db.listCustomers(list => {
    profile = list.find(c => c.id === customerId);
    renderBalance();
  }));
  unsubscribers.push(db.listCollectionsForCustomer(customerId, rows => {
    collections = rows;
    if (document.querySelector(".tab-btn.active")?.dataset.tab === "history") wireTab("history");
  }));
  unsubscribers.push(db.listWithdrawalsForCustomer(customerId, rows => {
    withdrawals = rows;
    if (document.querySelector(".tab-btn.active")?.dataset.tab === "withdraw") wireTab("withdraw");
  }));

  wireTab("history");
}

function flash(msg) {
  const el = document.createElement("div");
  el.className = "flash";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 2600);
}

// ---------------- ROUTER ----------------

db.watchAuth(async user => {
  clearSubs();
  currentUser = user;
  if (!user) {
    currentProfile = null;
    renderLogin();
    return;
  }
  currentProfile = await db.getUserProfile(user.uid);
  if (!currentProfile) { renderLogin(); return; }
  if (currentProfile.role === "admin") renderAdmin();
  else if (currentProfile.role === "collector") renderCollector();
  else renderCustomer();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
