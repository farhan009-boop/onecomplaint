// ==========================================================================
// 1. FIREBASE SETUP
// ==========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDtkXEIHXJrHymHyVHe587-1y9vpMurgLY",
    authDomain: "onecomplaint-618c0.firebaseapp.com",
    projectId: "onecomplaint-618c0",
    storageBucket: "onecomplaint-618c0.firebasestorage.app",
    messagingSenderId: "622889046391",
    appId: "1:622889046391:web:9239f3ee3ec81d28775172"
};

let auth = null;
try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    auth.useDeviceLanguage();
} catch (error) {
    console.error("Firebase init error:", error);
}

// ==========================================================================
// 2. GLOBAL STATE
// ==========================================================================
let analysisResult = {};
let trackingCoordinates = { latitude: null, longitude: null };
let mediaStreamInstance = null;
let attachedImagesBase64 = [];
let authenticatedCitizenProfile = { name: "", email: "", phone: "", address: "", city: "", pincode: "" };

// ==========================================================================
// 3. PRELOADER
// ==========================================================================
window.addEventListener("DOMContentLoaded", () => {
    const preloader = document.getElementById("app-preloader");
    if (preloader) {
        setTimeout(() => {
            preloader.style.opacity = "0";
            setTimeout(() => { preloader.style.display = "none"; }, 400);
        }, 1200);
    }

    const menuBtn = document.getElementById("menuToggleBtn");
    if (menuBtn) {
        menuBtn.addEventListener("click", () => {
            document.getElementById("navMenu").classList.toggle("mobile-active");
        });
    }
});

// ==========================================================================
// 4. AUTH MODAL FUNCTIONS
// ==========================================================================
window.openAuthModal = function() {
    const m = document.getElementById("auth-gateway-modal");
    if (m) { m.style.display = "flex"; document.body.style.overflow = "hidden"; }
};
window.closeAuthModal = function() {
    const m = document.getElementById("auth-gateway-modal");
    if (m) { m.style.display = "none"; document.body.style.overflow = "auto"; }
};

window.toggleAuthTabs = function(target) {
    document.getElementById("tab-login-btn").classList.toggle("active", target === "login");
    document.getElementById("tab-signup-btn").classList.toggle("active", target === "signup");
    document.getElementById("login-form-block").style.display = target === "login" ? "block" : "none";
    document.getElementById("signup-form-block").style.display = target === "signup" ? "block" : "none";
};

// ==========================================================================
// 5. GOOGLE SIGN IN (WORKING)
// ==========================================================================
window.signInWithGoogle = function() {
    if (!auth) return alert("Firebase not connected.");
    const btn = document.getElementById("googleSignInBtn");
    btn.innerText = "Opening Google...";
    btn.disabled = true;

    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            // Auto-fill profile from Google account
            authenticatedCitizenProfile.name = user.displayName || "";
            authenticatedCitizenProfile.email = user.email || "";
            // Save to localStorage
            const saved = JSON.parse(localStorage.getItem("oc_local_profile") || "{}");
            authenticatedCitizenProfile = Object.assign(authenticatedCitizenProfile, saved);
            authenticatedCitizenProfile.name = user.displayName || authenticatedCitizenProfile.name;
            authenticatedCitizenProfile.email = user.email || authenticatedCitizenProfile.email;
            localStorage.setItem("oc_local_profile", JSON.stringify(authenticatedCitizenProfile));
            closeAuthModal();
            updateHeaderAfterLogin();
        })
        .catch((error) => {
            alert("Google Sign-In failed: " + error.message);
            btn.innerText = "Continue with Google";
            btn.disabled = false;
        });
};

// ==========================================================================
// 6. EMAIL AUTH (LOGIN & SIGNUP)
// ==========================================================================
window.loginWithEmail = function() {
    if (!auth) return alert("Firebase not connected.");
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();
    if (!email || !password) return alert("Please enter email and password.");

    auth.signInWithEmailAndPassword(email, password)
        .then((result) => {
            authenticatedCitizenProfile.email = result.user.email;
            const saved = JSON.parse(localStorage.getItem("oc_local_profile") || "{}");
            authenticatedCitizenProfile = Object.assign(authenticatedCitizenProfile, saved);
            authenticatedCitizenProfile.email = result.user.email;
            localStorage.setItem("oc_local_profile", JSON.stringify(authenticatedCitizenProfile));
            closeAuthModal();
            updateHeaderAfterLogin();
        })
        .catch((e) => alert("Login failed: " + e.message));
};

window.signupWithEmail = function() {
    if (!auth) return alert("Firebase not connected.");
    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value.trim();
    if (!name || !email || !password) return alert("Name, Email and Password are required.");

    auth.createUserWithEmailAndPassword(email, password)
        .then((result) => {
            // Save all registration details
            authenticatedCitizenProfile.name = name;
            authenticatedCitizenProfile.email = email;
            authenticatedCitizenProfile.phone = document.getElementById("reg-phone").value.trim();
            authenticatedCitizenProfile.address = document.getElementById("reg-address").value.trim();
            authenticatedCitizenProfile.city = document.getElementById("reg-city").value.trim();
            authenticatedCitizenProfile.pincode = document.getElementById("reg-pincode").value.trim();
            localStorage.setItem("oc_local_profile", JSON.stringify(authenticatedCitizenProfile));
            closeAuthModal();
            updateHeaderAfterLogin();
            alert("Account created! Welcome, " + name);
        })
        .catch((e) => alert("Signup failed: " + e.message));
};

// ==========================================================================
// 7. PROFILE MODAL
// ==========================================================================
window.openProfileModal = function(e) {
    if (e) e.preventDefault();
    if (!auth || !auth.currentUser) {
        openAuthModal();
        return;
    }
    // Fill profile form with saved data
    const saved = JSON.parse(localStorage.getItem("oc_local_profile") || "{}");
    authenticatedCitizenProfile = Object.assign(authenticatedCitizenProfile, saved);

    document.getElementById("p-name").value = authenticatedCitizenProfile.name || "";
    document.getElementById("p-phone").value = authenticatedCitizenProfile.phone || "";
    document.getElementById("p-address").value = authenticatedCitizenProfile.address || "";
    document.getElementById("p-city").value = authenticatedCitizenProfile.city || "";
    document.getElementById("p-pincode").value = authenticatedCitizenProfile.pincode || "";
    document.getElementById("profile-display-name").innerText = authenticatedCitizenProfile.name || "Citizen";
    document.getElementById("profile-display-email").innerText = authenticatedCitizenProfile.email || auth.currentUser.email || "";

    // Avatar initial
    const initial = (authenticatedCitizenProfile.name || "C").charAt(0).toUpperCase();
    document.getElementById("profile-avatar-circle").innerText = initial;

    const m = document.getElementById("profile-modal");
    if (m) { m.style.display = "flex"; document.body.style.overflow = "hidden"; }
};

window.closeProfileModal = function() {
    const m = document.getElementById("profile-modal");
    if (m) { m.style.display = "none"; document.body.style.overflow = "auto"; }
};

window.saveProfile = function() {
    authenticatedCitizenProfile.name = document.getElementById("p-name").value.trim();
    authenticatedCitizenProfile.phone = document.getElementById("p-phone").value.trim();
    authenticatedCitizenProfile.address = document.getElementById("p-address").value.trim();
    authenticatedCitizenProfile.city = document.getElementById("p-city").value.trim();
    authenticatedCitizenProfile.pincode = document.getElementById("p-pincode").value.trim();
    localStorage.setItem("oc_local_profile", JSON.stringify(authenticatedCitizenProfile));

    const msg = document.getElementById("profile-save-msg");
    msg.style.display = "block";
    setTimeout(() => { msg.style.display = "none"; }, 3000);

    updateHeaderAfterLogin();
};

function updateHeaderAfterLogin() {
    const saved = JSON.parse(localStorage.getItem("oc_local_profile") || "{}");
    authenticatedCitizenProfile = Object.assign(authenticatedCitizenProfile, saved);

    const displayName = authenticatedCitizenProfile.name
        ? authenticatedCitizenProfile.name.split(" ")[0]
        : (auth && auth.currentUser ? (auth.currentUser.displayName || "Citizen").split(" ")[0] : "Citizen");

    const profileBtn = document.getElementById("profile-indicator-name");
    if (profileBtn) profileBtn.innerText = "👤 " + displayName;

    const authBtn = document.getElementById("authPortalNavBtn");
    if (authBtn) {
        authBtn.innerText = "Logout";
        authBtn.onclick = handleLogout;
    }
}

window.handleLogout = function() {
    if (auth) {
        auth.signOut().then(() => {
            localStorage.clear();
            location.reload();
        });
    }
};

// ==========================================================================
// 8. FIREBASE AUTH STATE OBSERVER
// ==========================================================================
window.addEventListener("load", () => {
    // Geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                trackingCoordinates.latitude = pos.coords.latitude;
                trackingCoordinates.longitude = pos.coords.longitude;
                const badge = document.getElementById("geo-badge-text");
                const container = document.getElementById("header-location-badge");
                if (badge) badge.innerText = "Location Synced";
                if (container) { container.style.background = "#f0fff4"; container.style.color = "#2f855a"; container.style.borderColor = "#2f855a"; }
            },
            () => { const b = document.getElementById("geo-badge-text"); if (b) b.innerText = "Location Off"; },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    }

    // Check auth state after small delay (avoids flicker)
    setTimeout(() => {
        if (auth) {
            auth.onAuthStateChanged((user) => {
                if (user) {
                    // User already logged in - load their profile
                    const saved = JSON.parse(localStorage.getItem("oc_local_profile") || "{}");
                    authenticatedCitizenProfile = Object.assign({ name: user.displayName || "", email: user.email || "" }, saved);
                    if (user.displayName) authenticatedCitizenProfile.name = authenticatedCitizenProfile.name || user.displayName;
                    if (user.email) authenticatedCitizenProfile.email = authenticatedCitizenProfile.email || user.email;
                    updateHeaderAfterLogin();
                } else {
                    // Not logged in - show modal
                    openAuthModal();
                }
            });
        } else {
            openAuthModal();
        }
    }, 1500);
});

// ==========================================================================
// 9. MIC INPUT
// ==========================================================================
try {
    const AudioTranscriber = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (AudioTranscriber) {
        const transcriber = new AudioTranscriber();
        transcriber.continuous = false;
        transcriber.lang = "en-IN";

        const voiceBtn = document.getElementById("voiceBtn");
        if (voiceBtn) {
            voiceBtn.addEventListener("click", () => {
                if (voiceBtn.classList.contains("active-recording")) {
                    transcriber.stop();
                } else {
                    voiceBtn.classList.add("active-recording");
                    transcriber.start();
                }
            });
        }
        transcriber.onresult = (e) => {
            const txt = document.getElementById("complaint");
            if (txt) txt.value = txt.value ? txt.value.trim() + " " + e.results[0][0].transcript : e.results[0][0].transcript;
        };
        transcriber.onend = () => { const v = document.getElementById("voiceBtn"); if (v) v.classList.remove("active-recording"); };
        transcriber.onerror = () => { const v = document.getElementById("voiceBtn"); if (v) v.classList.remove("active-recording"); };
    }
} catch (e) {}

// ==========================================================================
// 10. FILE + CAMERA ATTACHMENT
// ==========================================================================
function renderThumbnails() {
    const dock = document.getElementById("attachment-preview-dock");
    const warning = document.getElementById("media-limit-warning");
    if (!dock) return;
    dock.innerHTML = "";
    if (attachedImagesBase64.length > 0) {
        dock.style.display = "flex";
        attachedImagesBase64.forEach((base64, index) => {
            dock.innerHTML += `<div class="thumbnail-wrapper animate-fade-up"><img src="${base64}" class="preview-thumbnail-img"><span class="remove-thumbnail-badge" onclick="removeImage(${index})">&times;</span></div>`;
        });
    } else {
        dock.style.display = "none";
    }
    if (warning) warning.style.display = attachedImagesBase64.length >= 3 ? "block" : "none";
}

window.removeImage = function(index) { attachedImagesBase64.splice(index, 1); renderThumbnails(); };

const fileBtn = document.getElementById("fileBtn");
const hiddenFileInput = document.getElementById("hiddenFileInput");
if (fileBtn && hiddenFileInput) {
    fileBtn.addEventListener("click", () => hiddenFileInput.click());
    hiddenFileInput.addEventListener("change", (e) => {
        Array.from(e.target.files).forEach(file => {
            if (attachedImagesBase64.length >= 3) return;
            const reader = new FileReader();
            reader.onload = (event) => { attachedImagesBase64.push(event.target.result); renderThumbnails(); };
            reader.readAsDataURL(file);
        });
    });
}

const cameraBtn = document.getElementById("cameraBtn");
if (cameraBtn) {
    cameraBtn.addEventListener("click", async () => {
        if (attachedImagesBase64.length >= 3) return alert("Maximum 3 files reached.");
        const frame = document.getElementById("camera-preview-window");
        const video = document.getElementById("webcam-video");
        if (frame.style.display !== "none") { closeCamera(); return; }
        try {
            mediaStreamInstance = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = mediaStreamInstance;
            frame.style.display = "block";
        } catch (err) { alert("Camera access denied."); }
    });
}

const captureBtn = document.getElementById("captureSnapshotBtn");
if (captureBtn) {
    captureBtn.addEventListener("click", () => {
        if (attachedImagesBase64.length >= 3) return;
        const video = document.getElementById("webcam-video");
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        attachedImagesBase64.push(canvas.toDataURL("image/jpeg"));
        renderThumbnails();
        closeCamera();
    });
}

window.closeCamera = function() {
    if (mediaStreamInstance) mediaStreamInstance.getTracks().forEach(t => t.stop());
    const frame = document.getElementById("camera-preview-window");
    if (frame) frame.style.display = "none";
};

// ==========================================================================
// 11. ANALYZE & ROADMAP GENERATION
// ==========================================================================
const analyzeBtn = document.getElementById("analyzeBtn");
if (analyzeBtn) {
    analyzeBtn.addEventListener("click", async () => {
        const complaint = document.getElementById("complaint").value.trim();
        if (!complaint) return alert("Please describe your problem first.");

        analyzeBtn.innerHTML = `<svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:6px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Analyzing...`;
        analyzeBtn.disabled = true;

        try {
            const res = await fetch("/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ complaint, images: attachedImagesBase64 })
            });
            const d = await res.json();
            analysisResult = d.result;

            const solutionDesk = document.getElementById("solution-desk");
            solutionDesk.style.display = "block";

            // Build meta indicators
            document.getElementById("meta-indicators").innerHTML = `
                <div class="insight-item"><strong>📌 Category</strong><span class="insight-chip">${analysisResult.category || "Public Infrastructure"}</span></div>
                <div class="insight-item"><strong>🏢 Department</strong><span style="text-align:right;color:#334e68;font-weight:600;">${analysisResult.department || "Municipal Corporation"}</span></div>
                <div class="insight-item"><strong>👤 Authority Desk</strong><span style="text-align:right;color:#334e68;font-weight:600;">${analysisResult.authority || "Zonal Executive Engineer"}</span></div>
                <div class="insight-item"><strong>🚨 Priority</strong><span class="priority-badge priority-${(analysisResult.priority || "medium").toLowerCase()}">${analysisResult.priority || "Medium"}</span></div>
            `;

            // Build complaint roadmap
            buildComplaintRoadmap(analysisResult);

            solutionDesk.scrollIntoView({ behavior: "smooth" });
        } catch (e) {
            alert("AI Backend Issue. Make sure your server.js is running with: node server.js");
        } finally {
            analyzeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Deep Analyze & Resolve`;
            analyzeBtn.disabled = false;
        }
    });
}

// ==========================================================================
// 12. COMPLAINT ROADMAP BUILDER
// ==========================================================================
function buildComplaintRoadmap(result) {
    const roadmapDiv = document.getElementById("complaint-roadmap");
    const dept = result.department || "Municipal Corporation";
    const authority = result.authority || "Zonal Engineer";
    const category = result.category || "Public Issue";
    const city = result.city || "Your City";

    const steps = [
        {
            icon: "📝",
            title: "Step 1 — File Online First",
            color: "#e3f2fd",
            border: "#1565c0",
            content: `Go to your city's official grievance portal or the <strong>CPGRAMS portal (cpgrams.gov.in)</strong> and register your complaint digitally. Select category: <strong>${category}</strong>. You will get a reference/ticket number — save it.`,
            helpline: "CPGRAMS Helpline: 1800-11-7800 (Free)",
            link: "https://cpgrams.gov.in",
            linkText: "Open CPGRAMS Portal"
        },
        {
            icon: "🏢",
            title: "Step 2 — Visit Local Department Office",
            color: "#fff8e1",
            border: "#f57f17",
            content: `If no response within <strong>7 working days</strong>, visit the <strong>${dept}</strong> office in ${city}. Meet the <strong>${authority}</strong> directly and submit a written complaint (use the generated letter below). Request an acknowledgement receipt with stamp and signature.`,
            helpline: "Local Grievance Desk: 155305 (National Municipal Helpline)",
            link: null
        },
        {
            icon: "📞",
            title: "Step 3 — Escalate via Helpline",
            color: "#f3e5f5",
            border: "#6a1b9a",
            content: `Call the department's official helpline and quote your reference number. For <strong>${category}</strong> issues, escalate to the District Collector's office or Zonal Commissioner if the department doesn't respond.`,
            helpline: getHelplineForCategory(category),
            link: null
        },
        {
            icon: "⚖️",
            title: "Step 4 — File RTI if Ignored",
            color: "#e8f5e9",
            border: "#2e7d32",
            content: `If no action within <strong>30 days</strong>, file an RTI (Right to Information) application to the <strong>${dept}</strong> asking: "What action was taken on complaint reference [your number]?" This legally forces a reply within 30 days.`,
            helpline: "RTI Filing Portal: rtionline.gov.in | Fee: ₹10 only",
            link: "https://rtionline.gov.in",
            linkText: "File RTI Online"
        },
        {
            icon: "🧑‍⚖️",
            title: "Step 5 — Consumer Forum / High Court",
            color: "#fce4ec",
            border: "#880e4f",
            content: `Last resort: File a complaint at your District Consumer Forum or write to the State Human Rights Commission. For infrastructure negligence causing injury or loss, you can file a petition in the High Court's Public Interest Division.`,
            helpline: "National Consumer Helpline: 1800-11-4000 (Free)",
            link: "https://consumerhelpline.gov.in",
            linkText: "Consumer Forum Portal"
        }
    ];

    roadmapDiv.style.display = "block";
    roadmapDiv.innerHTML = `
        <div class="roadmap-header">
            <h4>🗺️ Your Complete Complaint Escalation Roadmap</h4>
            <p>Follow these steps in order. Do not skip — each step creates a legal paper trail.</p>
        </div>
        ${steps.map((step, i) => `
            <div class="roadmap-step" style="border-left-color:${step.border};background:${step.color};" data-step="${i}">
                <div class="roadmap-step-icon">${step.icon}</div>
                <div class="roadmap-step-body">
                    <div class="roadmap-step-title">${step.title}</div>
                    <div class="roadmap-step-desc">${step.content}</div>
                    <div class="roadmap-helpline">📞 ${step.helpline}</div>
                    ${step.link ? `<a href="${step.link}" target="_blank" class="roadmap-link">${step.linkText} ↗</a>` : ""}
                </div>
            </div>
            ${i < steps.length - 1 ? '<div class="roadmap-connector">↓</div>' : ""}
        `).join("")}
    `;
}

function getHelplineForCategory(category) {
    const cat = (category || "").toLowerCase();
    if (cat.includes("road") || cat.includes("pothole")) return "PWD Helpline: 1073 | National Road Helpline: 1033";
    if (cat.includes("sewage") || cat.includes("water") || cat.includes("drain")) return "Water Board Helpline: 1916";
    if (cat.includes("electric") || cat.includes("power") || cat.includes("light")) return "Electricity Helpline: 19122";
    if (cat.includes("cyber") || cat.includes("fraud") || cat.includes("scam")) return "Cyber Crime Helpline: 1930 (24/7)";
    if (cat.includes("food") || cat.includes("fssai")) return "FSSAI Consumer Helpline: 1800-11-2100";
    if (cat.includes("traffic") || cat.includes("accident")) return "Traffic Police: 1095 | Emergency: 112";
    if (cat.includes("garbage") || cat.includes("waste")) return "Swachh Bharat Helpline: 1969";
    return "National Citizen Helpline: 14404 | Emergency: 112";
}

// ==========================================================================
// 13. LETTER GENERATION
// ==========================================================================
const letterBtn = document.getElementById("letterBtn");
if (letterBtn) {
    letterBtn.addEventListener("click", async () => {
        // IMPORTANT: Load latest profile data from localStorage
        const savedProfile = localStorage.getItem("oc_local_profile");
        if (savedProfile) {
            authenticatedCitizenProfile = Object.assign(authenticatedCitizenProfile, JSON.parse(savedProfile));
        }

        // Warn user if profile is empty
        if (!authenticatedCitizenProfile.name) {
            const confirmMsg = confirm("⚠️ Your profile is empty! Click OK to fill profile first, or Cancel to generate letter without details.");
            if (confirmMsg) {
                openProfileModal();
                return;
            }
        }

        const letterPanel = document.getElementById("letter-panel");
        letterPanel.style.display = "block";
        document.getElementById("letter-output").innerHTML = `<div class="letter-loading"><div class="letter-spinner"></div><span>Generating official letter with your details...</span></div>`;

        try {
            const res = await fetch("/generate-letter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...analysisResult,
                    citizenName: authenticatedCitizenProfile.name || "Concerned Citizen",
                    citizenEmail: authenticatedCitizenProfile.email || "Not Provided",
                    citizenPhone: authenticatedCitizenProfile.phone || "Not Provided",
                    citizenAddress: authenticatedCitizenProfile.address || "Not Provided",
                    citizenCity: authenticatedCitizenProfile.city || "Not Provided",
                    citizenPincode: authenticatedCitizenProfile.pincode || "Not Provided",
                })
            });
            const d = await res.json();
            document.getElementById("letter-output").innerText = d.letter;
            letterPanel.scrollIntoView({ behavior: "smooth" });
        } catch (e) {
            document.getElementById("letter-output").innerText =
                `To,\nThe ${analysisResult.authority || "Concerned Authority"},\n${analysisResult.department || "Department"},\n${analysisResult.city || "City"}\n\nSub: Official Complaint Regarding ${analysisResult.category || "Public Issue"}\n\nRespected Sir/Madam,\n\nI, ${authenticatedCitizenProfile.name || "[Your Name]"}, residing at ${authenticatedCitizenProfile.address || "[Your Address]"}, ${authenticatedCitizenProfile.city || "[City]"} - ${authenticatedCitizenProfile.pincode || "[Pincode]"}, wish to bring to your urgent attention the following issue:\n\n${analysisResult.problem || "[Your complaint details]"}\n\nI request you to kindly look into this matter and take necessary action at the earliest.\n\nYours sincerely,\n${authenticatedCitizenProfile.name || "[Your Name]"}\nPhone: ${authenticatedCitizenProfile.phone || "[Phone]"}\nDate: ${new Date().toLocaleDateString("en-IN")}`;
        }
    });
}

// ==========================================================================
// 14. PDF DOWNLOAD (saves file, not print dialog)
// ==========================================================================
const pdfBtn = document.getElementById("pdfBtn");
if (pdfBtn) {
    pdfBtn.addEventListener("click", () => {
        const textData = document.getElementById("letter-output").innerText;
        if (!textData || textData.trim() === "") return alert("Generate the letter first before downloading.");

        const formattedText = textData.replace(/\n/g, "<br>");
        const fileName = `OneComplaint_${analysisResult.category || "Complaint"}_${new Date().toISOString().split('T')[0]}.html`;
        
        const printHTML = `<!DOCTYPE html><html><head><title>${fileName}</title><meta charset="UTF-8"><style>
            body{font-family:'Times New Roman',serif;padding:40px;color:#000;background:#fff;line-height:1.7;font-size:15px;margin:0;}
            .header{border-bottom:3px double #0b3d91;margin-bottom:25px;padding-bottom:15px;}
            .logo-line{font-size:22px;font-weight:900;color:#0b3d91;letter-spacing:1px;}
            .logo-line span{color:#ff9933;}
            .meta-row{font-size:13px;color:#333;margin:4px 0;}
            .letter-body{margin-top:20px;font-size:15px;white-space:pre-wrap;word-wrap:break-word;}
            @media print{@page{margin:20mm;}body{padding:20mm;}}
        </style></head><body>
            <div class="header">
                <div class="logo-line">ONE<span>COMPLAINT</span> 🇮🇳 Official Citizen Record</div>
                <div class="meta-row"><strong>Citizen Name:</strong> ${authenticatedCitizenProfile.name || "Not Specified"}</div>
                <div class="meta-row"><strong>Email:</strong> ${authenticatedCitizenProfile.email || "Not Specified"}</div>
                <div class="meta-row"><strong>Phone:</strong> ${authenticatedCitizenProfile.phone || "Not Specified"}</div>
                <div class="meta-row"><strong>Address:</strong> ${authenticatedCitizenProfile.address || "Not Specified"}, ${authenticatedCitizenProfile.city || ""}, ${authenticatedCitizenProfile.pincode || ""}</div>
                <div class="meta-row"><strong>Date Filed:</strong> ${new Date().toLocaleDateString("en-IN", {day:"2-digit",month:"long",year:"numeric"})}</div>
                <div class="meta-row"><strong>Department:</strong> ${analysisResult.department || "N/A"} | <strong>Authority:</strong> ${analysisResult.authority || "N/A"}</div>
            </div>
            <div class="letter-body">${formattedText}</div>
            <div style="margin-top:40px;padding-top:20px;border-top:1px solid #ccc;text-align:center;font-size:12px;color:#666;">
                <p>This document was generated by OneComplaint on ${new Date().toLocaleDateString("en-IN")} at ${new Date().toLocaleTimeString("en-IN")}</p>
                <p>Please print and submit this to the concerned government office.</p>
            </div>
        </body></html>`;

        const blob = new Blob([printHTML], { type: "text/html" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // Show success message
        showSuccessMessage("✅ PDF Downloaded! Ready to print and submit to office.");
        
        // Reset after 3 seconds
        setTimeout(() => {
            resetComplaintForm();
        }, 3000);
    });
}

function showSuccessMessage(message) {
    const msgDiv = document.createElement("div");
    msgDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #138808;
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: 700;
        z-index: 2000;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        animation: slideDown 0.4s ease;
    `;
    msgDiv.innerText = message;
    document.body.appendChild(msgDiv);
    setTimeout(() => msgDiv.remove(), 3000);
}

function resetComplaintForm() {
    document.getElementById("complaint").value = "";
    attachedImagesBase64 = [];
    renderThumbnails();
    document.getElementById("solution-desk").style.display = "none";
    document.getElementById("letter-panel").style.display = "none";
    document.getElementById("home").scrollIntoView({ behavior: "smooth" });
}

// ==========================================================================
// 15. GMAIL BUTTON
// ==========================================================================
const gmailBtn = document.getElementById("gmailBtn");
if (gmailBtn) {
    gmailBtn.addEventListener("click", () => {
        const textData = document.getElementById("letter-output").innerText;
        const to = analysisResult.authority ? "" : "";
        const subject = `Official Complaint - ${analysisResult.category || "Public Issue"} - ${analysisResult.area || analysisResult.city || ""}`;
        window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(textData)}`);
        
        // Show success message
        showSuccessMessage("✅ Gmail opened! Review and send your complaint letter.");
        
        // Reset after 4 seconds
        setTimeout(() => {
            resetComplaintForm();
        }, 4000);
    });
}

// ==========================================================================
// 16. SLA TABLE TOGGLE
// ==========================================================================
const showMoreSlaBtn = document.getElementById("show-more-sla-btn");
if (showMoreSlaBtn) {
    showMoreSlaBtn.addEventListener("click", function() {
        const hiddenRows = document.querySelectorAll(".sla-extra-row");
        const isHidden = hiddenRows[0] && hiddenRows[0].style.display === "none";
        hiddenRows.forEach(row => { row.style.display = isHidden ? "table-row" : "none"; });
        this.innerText = isHidden ? "Hide Extra Timelines ⬆" : "View All 20 Timelines ⬇";
    });
}

// ==========================================================================
// 17. WARD DIRECTORY — FULLY FILLED DATA
// ==========================================================================
const articleDatabase = {
    rti: {
        title: "Right to Information (RTI) — Complete Master Guide",
        dept: "Central Information Commission (CIC) / State Information Commission",
        helpline: "1800-11-7800",
        website: "https://rtionline.gov.in",
        websiteText: "rtionline.gov.in (File Online)",
        emergency: "No emergency — 30-day statutory response time",
        steps: `STEP 1 — Identify the correct Public Authority (PIO — Public Information Officer)
The department you are complaining about has a designated PIO. You must address the RTI to them specifically.

STEP 2 — Draft your RTI Application
Write specific, factual questions. Do NOT ask "Why" — instead ask:
• "Provide certified copies of all documents related to..."
• "What is the status of complaint filed on [date]?"
• "How much budget was allocated for [project] in FY 2024-25?"

STEP 3 — Pay the ₹10 Fee
Online: Pay via rtionline.gov.in (UPI/NetBanking accepted)
Offline: Buy a ₹10 Postal Order from any post office

STEP 4 — Submit Application
Online: rtionline.gov.in | Offline: Hand-deliver with acknowledgement copy

STEP 5 — Wait 30 Days (legally mandated)
If no reply in 30 days → File First Appeal to the same department's Appellate Authority

STEP 6 — File Second Appeal to CIC
If First Appeal ignored → File Second Appeal at cic.gov.in — this is the final authority`,
        template: `To,
The Public Information Officer (PIO),
[Department Name],
[Office Address]

Subject: Application Under Right to Information Act, 2005

Respected Sir/Madam,

I, [Your Name], a citizen of India, hereby request the following information under Section 6 of the RTI Act, 2005:

1. Certified copies of all documents, orders, and communications related to: [Specific query]
2. Action taken report on complaint filed on: [Date, if any]
3. Name and designation of the officer responsible for: [Specific matter]

I am enclosing ₹10/- as application fee via Indian Postal Order / online payment.

Please provide the information within the statutory period of 30 days.

Yours faithfully,
[Your Full Name]
[Address]
[Phone Number]
Date: [Date]`
    },
    sewage: {
        title: "Sewage & Drainage — Official Complaint Roadmap",
        dept: "Municipal Water & Sanitation Board / State Water Supply Department",
        helpline: "1916",
        website: "https://nmcg.nic.in",
        websiteText: "NMCG — National Mission for Clean Ganga",
        emergency: "EMERGENCY OVERFLOW: Call 1916 — 24-hour rapid response mandated",
        steps: `STEP 1 — Document the Issue
Take wide-angle photographs showing the overflow location. Note the nearest landmark, pole number, or manhole number. Record the GPS location.

STEP 2 — Call 1916 (National Water/Sanitation Helpline)
This is a FREE 24-hour helpline. Report the exact location — lane name, nearby landmark, house/flat number. Get a complaint ticket number. Response mandated within 24 hours for sewage overflow.

STEP 3 — File on Swachhata App / CPGRAMS
Download Swachh Bharat's "Swachhata" app or go to cpgrams.gov.in. Upload your photos and GPS location. This creates a digital record with timestamps.

STEP 4 — Visit Local Municipal Office (if no response in 48 hrs)
Go to your local municipal ward office. Ask to meet the Sanitary Inspector or Executive Engineer. Submit written complaint requesting acknowledgement.

STEP 5 — Escalate to District Collector
If municipality ignores: Write to the District Collector's office with all evidence. DC's office has the power to issue orders to the municipality.`,
        template: `To,
The Executive Engineer (Sanitation),
Municipal Corporation / Water Board,
[City]

Subject: Urgent Complaint — Sewage Overflow at [Location] — Immediate Action Required

Respected Sir/Madam,

I, [Your Name], residing at [Address], wish to report a severe sewage overflow / drainage blockage at [Exact Location: Street Name, Ward No.] that has been causing a serious public health hazard since [Date].

Details of the Issue:
• Location: [Street/Area]
• Nature: Sewage backflow / Manhole overflow / Blocked drain
• Duration: [How many days]
• Impact: Risk of waterborne diseases, foul smell, road damage

I request you to dispatch a suction pump team and maintenance crew immediately. As per the Citizen Charter, sewage overflow must be addressed within 24 hours.

Failing to act will force me to escalate to the District Collector and file an RTI.

Yours sincerely,
[Your Name] | Phone: [Number] | Date: [Date]`
    },
    roads: {
        title: "PWD Roads & Potholes — Step-by-Step Guide",
        dept: "Public Works Department (PWD) / National Highways Authority of India (NHAI)",
        helpline: "1073",
        website: "https://pwd.gov.in",
        websiteText: "PWD Official Portal",
        emergency: "Accident due to pothole: Call 112 first, then 1073 for PWD complaint",
        steps: `STEP 1 — Identify Who Owns the Road
• Municipal road (inside city) → Contact Municipal Corporation
• State highway → Contact State PWD office
• National highway → Contact NHAI at nhai.gov.in or helpline 1033

STEP 2 — Photograph the Pothole Properly
Take photos showing: (a) The pothole with a scale reference like a bottle, (b) Wide-angle showing the road name/landmark, (c) Any vehicles that have been damaged. Note the GPS coordinates.

STEP 3 — File Complaint Online
• Municipal roads: Your city's complaint portal or CPGRAMS
• NHAI: nhai.gov.in/complaint-portal
• Delhi: 155305 or Delhi PWD portal
• Call 1073 — National Road Helpline (Free, 24×7)

STEP 4 — Send Written Complaint with Photos
Address to the Zonal/Assistant Engineer of the responsible department. Demand repair within the statutory 7 working days.

STEP 5 — Claim Compensation for Vehicle Damage
If your vehicle was damaged due to a pothole, you have the legal right to claim compensation from the PWD/NHAI. File a Motor Accident Claim in district court with photos and mechanic receipt.`,
        template: `To,
The Assistant Engineer (Civil),
Public Works Department,
[Zone/District]

Subject: Complaint Regarding Dangerous Pothole at [Location] — Immediate Repair Requested

Respected Sir/Madam,

I, [Your Name], resident of [Address], wish to formally report a hazardous pothole at [Exact Road Name and Location] that poses serious risk to commuters and has already caused [vehicle damage / accidents — if any].

Description:
• Road Name: [Name]
• Location Coordinates (approx): [GPS if available]
• Pothole Size: Approximately [dimensions]
• Existing Duration: [Number of days/weeks]
• Incidents caused: [Any accidents, vehicle damage]

As per the PWD Citizen Charter, road repairs must be completed within 7 working days of complaint registration.

I am attaching photographic evidence. Please take immediate corrective action. I reserve the right to file an RTI and approach the District Collector if no action is taken.

Respectfully,
[Your Name] | Address: [Address] | Phone: [Number] | Date: [Date]`
    },
    electricity: {
        title: "Electricity Grid — Fault & Grievance Guide",
        dept: "State Electricity Distribution Company (DISCOM) / State Electricity Board",
        helpline: "19122",
        website: "https://www.cea.nic.in",
        websiteText: "CEA — Central Electricity Authority",
        emergency: "LIVE WIRE DOWN: Call 112 immediately, then 19122 for DISCOM",
        steps: `STEP 1 — Note the Transformer Number
Every transformer/pole has a number painted on it. Note this number — it helps DISCOM locate the fault instantly.

STEP 2 — Call 19122 (National Electricity Helpline)
Available 24 hours. Provide: transformer number, area, fault type (no power/sparking wire/meter issue/streetlight). Get complaint number.

STEP 3 — Report on DISCOM App / Website
Most state DISCOMs have mobile apps. Download your state's DISCOM app and log the fault. Streetlight faults specifically go to your Municipal Corporation.

STEP 4 — Complaint to Electricity Ombudsman
If billing issue or supply problem not resolved in 30 days, file a complaint to the State Electricity Ombudsman — this is a regulatory authority with power to penalize the DISCOM.

STEP 5 — File at State Electricity Regulatory Commission (SERC)
For serious consumer rights violations, escalate to your state's SERC. They can impose fines on the DISCOM.`,
        template: `To,
The Area Manager / Assistant Engineer (Electrical),
[DISCOM Name],
[Area Office Address]

Subject: Complaint Regarding [Power Outage / Faulty Streetlight / Meter Tampering] at [Location]

Respected Sir/Madam,

I wish to report a persistent electricity fault at [Address / Area] causing severe inconvenience and financial loss.

Fault Details:
• Type of Fault: [Power outage / Sparking wire / Meter issue / Streetlight not working]
• Transformer No. / Pole No.: [If known]
• Duration of Problem: [Days/Weeks]
• Previous Complaints Made: [Date and reference number if any]

This is causing loss of productivity, food spoilage, and safety concerns for residents.

I request urgent inspection and rectification within the statutory period. Failure to act will result in escalation to the State Electricity Ombudsman.

Yours sincerely,
[Your Name] | Consumer No: [Your DISCOM consumer number] | Phone: [Number] | Date: [Date]`
    },
    waste: {
        title: "Solid Waste & Garbage — Complaint Guide",
        dept: "Solid Waste Management Division / Municipal Sanitation Department",
        helpline: "155304",
        website: "https://swachhbharat.mygov.in",
        websiteText: "Swachh Bharat Mission Portal",
        emergency: "Chemical / Hazardous waste dumping: Call CPCB at 1800-11-0030",
        steps: `STEP 1 — Download the Swachhata App
Available on Play Store and App Store. Report directly with photo and GPS location. Complaints are auto-routed to the local municipal body.

STEP 2 — Call 155304 (Swachh Bharat Helpline)
Report illegal dumping with the exact location. Get a ticket number. Response time: 48 hours.

STEP 3 — Identify the Dumper
Note: Truck registration numbers, timing of dumping (usually early morning or late night), type of waste (construction debris, garbage, chemical waste).

STEP 4 — Complain to Sanitary Inspector
Visit the municipal ward office. The Sanitary Inspector has the power to issue challans (fines) of ₹500 to ₹5000 to the offending party under the Solid Waste Management Rules, 2016.

STEP 5 — Involve the Local Corporator / Ward Councillor
Elected ward representatives can formally instruct the municipality to take action. Approach your ward councillor with documented evidence.`,
        template: `To,
The Chief Sanitary Inspector,
Solid Waste Management Division,
Municipal Corporation, [City]

Subject: Complaint Against Illegal Garbage Dumping at [Location]

Respected Sir/Madam,

I, [Your Name], wish to bring to your attention a serious instance of illegal garbage / construction debris / commercial waste dumping at [Exact Location].

Incident Details:
• Location: [Address / GPS]
• Type of Waste: [Construction debris / Household garbage / Commercial waste]
• When it Occurs: [Timing and frequency]
• Vehicles Involved: [Registration numbers if observed]
• Duration: This has been going on for [Days/Weeks]

Under the Solid Waste Management Rules, 2016, illegal dumping is a punishable offence.

I request you to: (1) Issue challans to the offending parties, (2) Remove the dumped waste within 48 hours, (3) Install surveillance cameras or signage to prevent recurrence.

Respectfully,
[Your Name] | Address: [Address] | Phone: [Number] | Date: [Date]`
    },
    food: {
        title: "FSSAI Food Safety — Adulteration & Expiry Complaint Guide",
        dept: "Food Safety and Standards Authority of India (FSSAI) / State Food Safety Department",
        helpline: "1800-11-2100",
        website: "https://foscos.fssai.gov.in",
        websiteText: "FSSAI FoSCoS Portal",
        emergency: "Food poisoning outbreak: Call 112 for medical + 1800-11-2100 for FSSAI",
        steps: `STEP 1 — Preserve the Evidence
Keep the product, bill/receipt, and packaging intact. Do NOT throw away the item. Take photos of expiry dates, batch numbers, and any visible contamination.

STEP 2 — File on FSSAI Portal
Go to foscos.fssai.gov.in → Consumer Complaint section. Upload photos and purchase receipt. Get complaint reference number. Response: 48 hours for inspection.

STEP 3 — Call 1800-11-2100 (FSSAI Helpline — Free)
Report adulterated food, expired products, unlicensed vendors, or food poisoning. Available 9 AM – 5 PM.

STEP 4 — Local Food Safety Officer (FSO) Visit
FSSAI will dispatch an FSO to inspect the premises and collect samples. The sample is sent to a government laboratory for testing.

STEP 5 — Action & Penalty
If found guilty, the food business can face: ₹25,000 to ₹10 lakh fine, suspension of FSSAI license, criminal prosecution for severe adulteration.`,
        template: `To,
The Designated Officer / Food Safety Officer,
Food Safety and Standards Authority of India (FSSAI),
[State/District Office]

Subject: Complaint Against Sale of Adulterated / Expired Food at [Shop Name]

Respected Sir/Madam,

I, [Your Name], wish to formally report a food safety violation at [Shop Name / Restaurant Name], located at [Full Address].

Nature of Violation:
• Type: [Expired product / Adulteration / Unhygienic conditions / Unlicensed operation]
• Product: [Product name, brand, batch number]
• Expiry Date on Package: [Date printed]
• Date of Purchase: [Date]
• Bill Reference: [Bill number if available]

I am enclosing photographic evidence of the product, the expiry date, and the purchase receipt.

I request an immediate inspection of the premises and appropriate penal action under the Food Safety and Standards Act, 2006.

Yours sincerely,
[Your Name] | Phone: [Number] | Date: [Date]`
    },
    traffic: {
        title: "Traffic & Road Violations — Complaint Guide",
        dept: "City Traffic Police / State Transport Authority",
        helpline: "1095",
        website: "https://echallan.parivahan.gov.in",
        websiteText: "e-Challan Portal",
        emergency: "Accident / Emergency: 112 | Traffic Jam / Violation: 1095",
        steps: `STEP 1 — Document the Violation
Photograph/video the vehicle, clearly capturing the license plate, time, and nature of violation (illegal parking, wrong-way driving, overloading, commercial encroachment).

STEP 2 — Report on Traffic Police App
Most cities have a traffic police app (Delhi: TrafficHelp, Mumbai: Mumbai Traffic Police App). Upload photo + GPS location. Challan is sent to the vehicle owner.

STEP 3 — Call 1095 (Traffic Control Room)
Provide license plate number, exact location, nature of violation. For persistent encroachments, request a towing van.

STEP 4 — For Accident Claims
File FIR at nearest police station within 24 hours. Get a copy of FIR. Contact a Motor Accident Claims Tribunal (MACT) for compensation.

STEP 5 — For Illegal Commercial Encroachment
File complaint with your local municipality citing obstruction of public road. The shop/vendor can be penalized under the Street Vendors Act, 2014.`,
        template: `To,
The Traffic Inspector / Circle Officer,
[City] Traffic Police,
[Police Station Area]

Subject: Complaint Against [Illegal Parking / Traffic Violation / Road Encroachment] at [Location]

Respected Sir/Madam,

I, [Your Name], wish to formally report a serious traffic violation / encroachment at [Exact Location] that is causing traffic obstruction and safety hazards.

Details:
• Nature of Violation: [Illegal parking / Wrong-way driving / Commercial encroachment]
• Vehicle Number (if applicable): [Registration number]
• Location: [Street/Road/Area]
• Time of Occurrence: [Regular time if recurring]
• Impact: [Traffic jam / Accident risk / Pedestrian danger]

I have photographic / video evidence of the violation attached herewith.

I request immediate action — removal of encroachment / challan issuance — and preventive measures to avoid recurrence.

Yours sincerely,
[Your Name] | Phone: [Number] | Date: [Date]`
    },
    scam: {
        title: "Cyber Crime & Financial Fraud — Emergency Guide",
        dept: "National Cyber Crime Reporting Portal / State Cyber Cell",
        helpline: "1930",
        website: "https://cybercrime.gov.in",
        websiteText: "National Cyber Crime Portal (File Complaint)",
        emergency: "CALL 1930 IMMEDIATELY — Every minute matters to freeze your money",
        steps: `⚠️ IF YOU WERE JUST SCAMMED — DO THIS IN THE NEXT 30 MINUTES:

STEP 1 — Call 1930 IMMEDIATELY
The Cyber Crime financial fraud helpline (1930) can FREEZE the scammer's account before they withdraw your money. Call within 30 minutes for best chance of recovery.

STEP 2 — Block Your Bank Account
Call your bank's 24-hour helpline and report the fraud. They can put a hold on suspicious transactions. Keep your bank's helpline saved on your phone.

STEP 3 — File on cybercrime.gov.in
Create an account and file a detailed complaint with: transaction IDs, scammer's phone/email, screenshots of communication, bank statement showing debit.

STEP 4 — File FIR at Police Station
Take your cybercrime.gov.in complaint reference number to the nearest police station and file an FIR. Police are now legally bound to register cyber fraud FIRs.

STEP 5 — Collect Evidence
Screenshot all communications — WhatsApp, SMS, email, call logs. Note all transaction reference numbers. These will be needed for the court case.`,
        template: `To,
The Inspector, Cyber Crime Cell,
[City] Police,
[Police Station Address]

Subject: Complaint Regarding Cyber Financial Fraud — Immediate FIR Request

Respected Sir/Madam,

I, [Your Name], wish to report a cyber financial fraud in which I was deceived and suffered a financial loss of ₹[Amount].

Incident Details:
• Date and Time of Incident: [Date/Time]
• Mode of Fraud: [Online transfer / OTP fraud / Fake UPI / Investment scam / Job fraud]
• Money Lost: ₹[Amount]
• Fraudster's Contact: [Phone number / Email / Website]
• Transaction Reference: [UTR/Transaction ID]
• Bank Account Debited: [Your bank name and last 4 digits of account]

I have already called the 1930 Cyber Helpline on [Date]. Reference No: [Reference from 1930].

I request you to: (1) Immediately freeze the beneficiary's account, (2) Register an FIR, (3) Initiate recovery proceedings.

Yours sincerely,
[Your Name] | Phone: [Number] | Cybercrime Portal Ref: [Number] | Date: [Date]`
    },
    water: {
        title: "Water Supply — Contamination & Shortage Guide",
        dept: "State Jal Board / Municipal Water Supply Department",
        helpline: "1916",
        website: "https://jaljeevanmission.gov.in",
        websiteText: "Jal Jeevan Mission Portal",
        emergency: "CONTAMINATED WATER (Making people sick): Call 1916 — Emergency Response",
        steps: `STEP 1 — Verify the Problem
First check if your neighbors also face the same issue — if yes, it's a supply-side problem. If only you face it, check your internal pipes and water tank.

STEP 2 — Collect a Water Sample
For contamination complaints, fill clean bottles with the suspicious water. Seal them. Label them with date, time, and location. These will be sent to the government water testing lab.

STEP 3 — Call 1916 (Jal Board Helpline)
Report: your area, type of problem (no water / contaminated / low pressure / broken pipe). 24-hour service. Response mandated within 24-48 hours.

STEP 4 — File Online Complaint
Go to your state Jal Board website or cpgrams.gov.in. Upload photos and describe the issue. Attach your water bill with consumer number.

STEP 5 — Get Water Tested Free
Your district health department runs FREE water quality testing. Call your local PHC (Primary Health Centre) to request a water quality test.

STEP 6 — Escalate to District Collector
For large-scale contamination affecting a whole area, send complaint directly to the DC's office and the State Pollution Control Board.`,
        template: `To,
The Assistant Engineer / Zonal Officer,
[City] Jal Board / Water Supply Department,
[Area Office]

Subject: Urgent Complaint — [Water Contamination / Supply Disruption] at [Area Name]

Respected Sir/Madam,

I, [Your Name], Consumer No. [Your Jal Board consumer number if available], residing at [Address], wish to report a serious water supply issue in our area.

Problem Details:
• Issue Type: [No water supply / Contaminated / Discolored / Low pressure / Broken pipe]
• Area/Street Affected: [Name]
• Duration: [Since when]
• Number of Households Affected: Approximately [number]
• Impact: [Health risk / No water for cooking/drinking]

I have collected a water sample for testing as evidence of contamination.

As per the Citizen Charter, water supply issues must be resolved within 24-48 hours. I request immediate inspection and rectification.

Yours sincerely,
[Your Name] | Consumer No: [Number] | Phone: [Number] | Date: [Date]`
    },
    animals: {
        title: "Stray Animal Management — Complaint Guide",
        dept: "Municipal Veterinary Services / Animal Birth Control (ABC) Cell",
        helpline: "1962",
        website: "https://awbi.gov.in",
        websiteText: "Animal Welfare Board of India",
        emergency: "Dog/animal BITE: Go to hospital first for anti-rabies injection, then file complaint",
        steps: `STEP 1 — For Animal Bite — Hospital FIRST
Anti-rabies injection must be taken within 24 hours of a dog bite. Go to the nearest government hospital — it is FREE. Do not delay complaint filing over medical treatment.

STEP 2 — Call Local Municipal Helpline
Call your municipal corporation or 1962. Report the exact location of the aggressive pack, approximate number of animals, and whether they have been attacking people.

STEP 3 — Contact Animal Birth Control Cell
Most major cities have ABC cells that conduct Catch-Neuter-Return (CNR) programs. This is the humane and legal method — killing stray animals is prohibited under the Prevention of Cruelty to Animals Act.

STEP 4 — Report Animal Cruelty Separately
If someone is harming or poisoning stray animals, report to: (a) Police at 112, (b) AWBI at 044-24748321, (c) Local animal welfare NGO.

STEP 5 — Request Area Vaccination Drive
Municipalities are mandated to conduct periodic anti-rabies vaccination drives. Formally request one for your area through written complaint.`,
        template: `To,
The Veterinary Officer / ABC Cell In-Charge,
Municipal Corporation, [City]

Subject: Request for Immediate Stray Animal Management at [Location]

Respected Sir/Madam,

I, [Your Name], residing at [Address], wish to report a serious public safety concern caused by aggressive stray [dogs/monkeys] in our area at [Location].

Issue Details:
• Location: [Specific area]
• Number of Animals: Approximately [number]
• Aggression Level: [Chasing / Biting / Blocking roads]
• Recent Incidents: [Any bites or attacks reported]

Under the Prevention of Cruelty to Animals Act and municipal bylaws, the corporation is mandated to conduct:
1. Animal Birth Control (sterilization) and anti-rabies vaccination
2. Removal of dangerously aggressive animals

I request an immediate response, especially given the risk to children and elderly residents.

Yours sincerely,
[Your Name] | Phone: [Number] | Date: [Date]`
    },
    corruption: {
        title: "Anti-Corruption & Bribery — Reporting Guide",
        dept: "Anti-Corruption Bureau (ACB) / Central Vigilance Commission (CVC)",
        helpline: "1064",
        website: "https://cvc.gov.in",
        websiteText: "Central Vigilance Commission",
        emergency: "Active bribery demand: Call 1064 for live trap operation",
        steps: `STEP 1 — Do NOT Pay the Bribe
Paying a bribe makes YOU legally liable too. Refuse politely. Say you need time to arrange. This buys you time to set up a trap.

STEP 2 — Call 1064 — Anti-Corruption Helpline
The ACB can set up a sting operation with marked currency notes. They will catch the official red-handed. This is called a "trap case." Success rate is very high.

STEP 3 — Document Everything
Record the conversation (audio/video) if legally permitted in your state. Note: date, time, officer's name, designation, department, exact amount demanded, and purpose.

STEP 4 — File Complaint at CVC (Central Govt) or ACB (State Govt)
• Central government officer: cvc.gov.in
• State government officer: Your state's Vigilance Department / Lokayukta

STEP 5 — File RTI on File Movement
File an RTI asking for the status of your file or application that is being held hostage for a bribe. RTI often unblocks stuck files without needing to pay.`,
        template: `To,
The Director,
Anti-Corruption Bureau / Vigilance Department,
[State/City]

Subject: Formal Complaint of Bribery Demand by [Designation] at [Department]

Respected Sir/Madam,

I, [Your Name], wish to formally report an illegal bribe demand made by a government official in exchange for [processing my file / issuing a certificate / granting permission].

Complaint Details:
• Accused Official's Name/Designation: [Name / Post]
• Department & Office: [Department, Address]
• Bribe Amount Demanded: ₹[Amount]
• Purpose of Bribe: [What they want bribe for]
• Date of Demand: [Date]
• Witness (if any): [Name]

I have [audio/video/documentary] evidence of this illegal demand.

I request you to: (1) Register this complaint under the Prevention of Corruption Act, 1988, (2) Initiate a trap operation, (3) Take appropriate departmental and criminal action.

I am ready to cooperate fully in the investigation.

Yours sincerely,
[Your Name] | Phone: [Number] | Date: [Date]`
    },
    noise: {
        title: "Noise Pollution — Legal Complaint Guide",
        dept: "State Pollution Control Board / Local Police",
        helpline: "112",
        website: "https://cpcb.nic.in",
        websiteText: "Central Pollution Control Board",
        emergency: "Immediate noise disturbance after 10 PM: Call 112 for police response",
        steps: `STEP 1 — Know the Legal Limits
Under Noise Pollution Rules, 2000:
• Residential Zone: Day (6AM-10PM): 55 dB | Night (10PM-6AM): 45 dB
• Commercial Zone: Day: 65 dB | Night: 55 dB
After 10 PM, any loud music/loudspeaker is illegal without special permission.

STEP 2 — Measure the Noise (Optional but Powerful)
Download a free decibel meter app (e.g., NIOSH SLM or DecibelX). Record the reading. If it exceeds legal limits, this is solid evidence.

STEP 3 — Call 112 for Immediate Relief
For late-night noise or loudspeakers, police can take immediate action. They can issue on-the-spot fines and order cessation.

STEP 4 — File Complaint with Pollution Control Board
State PCB has the power to issue "noise pollution" notices and shut down persistent offenders (industries, shops, events).

STEP 5 — Write to the District Magistrate
For recurring events or festivals: Apply to the DM's office for enforcement of Noise Pollution Rules. The DM can restrict loudspeaker use and revoke permissions.`,
        template: `To,
The Station House Officer (SHO),
[Police Station Name],
[Address]

Subject: Complaint Against Illegal Noise Pollution / Loudspeaker Use at [Location]

Respected Sir/Madam,

I, [Your Name], residing at [Address], wish to report persistent illegal noise pollution caused by [loudspeakers / industrial machinery / party / DJ music] at [Location/Address of source].

Details:
• Source of Noise: [Identify the place/event/activity]
• Timing: [Start time — End time] — [Frequency: Daily / Weekly / One-time]
• Measured/Estimated Decibel Level: [If measured]
• Impact: Sleep disturbance, stress, medical condition aggravation, children's studies disrupted

As per the Noise Pollution (Regulation and Control) Rules, 2000, noise beyond legal limits — especially after 10 PM — is a criminal offence punishable under Section 268 IPC.

I request you to: (1) Issue immediate notice to the offending party, (2) Seize the equipment if rules are violated, (3) Register an FIR if violations continue.

Yours sincerely,
[Your Name] | Phone: [Number] | Date: [Date]`
    },
    encroachment: {
        title: "Illegal Encroachment — Complaint Guide",
        dept: "Municipal Building Department / Revenue Department / Local Police",
        helpline: "155305",
        website: "https://cpgrams.gov.in",
        websiteText: "CPGRAMS National Complaint Portal",
        emergency: "Active construction on your property: Call police at 112 immediately",
        steps: `STEP 1 — Establish the Legal Boundary
Get a copy of the land survey/cadastral map from the district revenue office. This is the official document showing where boundaries legally lie.

STEP 2 — Document the Encroachment
Photograph/video the encroachment clearly showing: the construction/structure, its proximity to the road/boundary, survey stones (if any), and signboards/measurements.

STEP 3 — File with Municipal Building Department
Submit a written complaint to the Zonal Building Inspector. Illegal construction on public land or roads violates the local Building Byelaws and can result in demolition orders.

STEP 4 — Complaint to Revenue Department
For encroachment on government land (roads, parks, canals), file with the Tahsildar or Revenue Inspector. They have authority to issue eviction notices.

STEP 5 — File Court Injunction (if on your property)
For encroachment on your private property, consult a lawyer and file for a temporary injunction in civil court to stop construction immediately.`,
        template: `To,
The Zonal Building Inspector,
Municipal Corporation / Revenue Department,
[City]

Subject: Complaint Against Illegal Construction / Encroachment at [Location]

Respected Sir/Madam,

I, [Your Name], wish to report an illegal construction / encroachment at [Exact Location] that violates local building byelaws and encroaches upon [public road / municipal land / my property].

Encroachment Details:
• Type: [Permanent structure / Temporary shop / Wall construction / Road occupation]
• Location: [Address or GPS coordinates]
• Encroacher's Details: [If known: Name / Property details]
• Duration: Construction/encroachment has been ongoing since [Date]
• Land Affected: [Government road / Public pathway / Survey plot number]

I am attaching photographic evidence, land survey documents, and GPS coordinates.

As per the relevant Municipal Byelaws and the Land Revenue Code, I request: (1) Immediate stop-work notice, (2) Survey/measurement of the encroachment, (3) Demolition of the illegal structure.

Yours sincerely,
[Your Name] | Phone: [Number] | Date: [Date]`
    },
    parks: {
        title: "Parks & Horticulture — Maintenance Complaint",
        dept: "Municipal Horticulture Department / Parks Division",
        helpline: "155305",
        website: "https://cpgrams.gov.in",
        websiteText: "CPGRAMS — File Online",
        emergency: "Hazardous/falling tree: Call municipality immediately + 112 if emergency",
        steps: `STEP 1 — Identify the Maintenance Issue
Common park complaints: broken benches, non-functional lights, broken swings (safety hazard for children), overgrown trees, damaged fencing, encroachment on park land, missing water facility.

STEP 2 — Photograph with Date Stamp
Take photos clearly showing the damaged equipment with a visible date. Include the park name/board in the frame if possible.

STEP 3 — File with Municipal Horticulture Department
Visit your ward office or call 155305. Ask specifically for the Horticulture Department's Landscape Superintendent or Parks Officer.

STEP 4 — Write to Ward Councillor
Your elected ward councillor has direct oversight of local parks. Writing to them with evidence often gets faster results than the bureaucratic chain.

STEP 5 — For Hazardous Tree
Hazardous or overgrown trees must be addressed within 5 working days. If a tree falls and causes damage/injury due to municipal negligence, you have legal grounds for compensation.`,
        template: `To,
The Landscape Superintendent / Parks Officer,
Horticulture Department,
Municipal Corporation, [City]

Subject: Complaint Regarding [Maintenance Issue] at [Park Name]

Respected Sir/Madam,

I, [Your Name], a regular user of [Park Name] located at [Area], wish to bring to your attention urgent maintenance issues that pose safety hazards to the public, especially children and the elderly.

Issues Observed:
1. [Issue 1: e.g., Broken swing — safety risk for children]
2. [Issue 2: e.g., Non-functional park lights — safety risk at night]
3. [Issue 3: e.g., Overgrown / hazardous tree leaning over pathway]
4. [Issue 4: e.g., Damaged perimeter fencing — security risk]

These issues have been present since [Date/Months] without any maintenance.

I request: (1) Immediate repair of safety-critical equipment, (2) Regular maintenance schedule, (3) Action against any encroachment within park boundaries.

Yours sincerely,
[Your Name] | Phone: [Number] | Date: [Date]`
    },
    mosquito: {
        title: "Mosquito & Vector Control — Fogging Request Guide",
        dept: "Municipal Health Department / Vector Control Division",
        helpline: "155305",
        website: "https://nvbdcp.gov.in",
        websiteText: "National Vector Borne Disease Control Programme",
        emergency: "Dengue/Malaria outbreak symptoms: Go to government hospital immediately — free treatment",
        steps: `STEP 1 — Identify Breeding Sources
Stagnant water is the main cause. Common sources: open drains, unused containers, flower pots, construction sites, waterlogged potholes, flat rooftops. Photograph these for your complaint.

STEP 2 — File Complaint for Fogging
Call 155305 or visit your ward office. Request: (a) Anti-larval treatment in drains, (b) Pyrethrum spray (fogging) for adult mosquitoes. Best done at dawn or dusk.

STEP 3 — Report Dengue/Malaria Cases
If residents in your area are falling sick: Report to the district health officer. The municipal health team is mandated to investigate cluster cases and spray the affected area within 24-48 hours.

STEP 4 — Involve RWA (Residents Welfare Association)
An RWA complaint carries more weight than individual complaints. Get your RWA president to sign a joint petition. This escalates priority.

STEP 5 — Escalate to Chief Medical Officer
If municipal body doesn't act and disease cases increase, write to the District CMO (Chief Medical Officer). They can issue emergency orders to the municipality.`,
        template: `To,
The Health Officer / Vector Control Superintendent,
Municipal Corporation, [City]

Subject: Request for Mosquito Fogging and Vector Control at [Area Name]

Respected Sir/Madam,

I, [Your Name], representing [myself / Residents of [Colony/Sector]], wish to report a severe mosquito infestation in our area at [Location] that is causing a dengue / malaria risk to residents.

Issue Details:
• Area Affected: [Colony / Sector / Street Name]
• Breeding Sources Identified: [Open drains / Waterlogged areas / Construction sites]
• Health Impact: [Number of residents reporting fever / suspected dengue cases]
• Last Fogging Done: [Date, or "never" if unknown]

Under the National Vector Control Programme, municipal bodies are required to conduct regular fogging operations, especially during peak mosquito season (monsoon and post-monsoon).

I request: (1) Immediate fogging of the affected area, (2) Anti-larval treatment in all open drains, (3) Enforcement against any establishment maintaining open stagnant water.

Yours sincerely,
[Your Name] | Address: [Area] | Phone: [Number] | Date: [Date]`
    }
};

window.openArticle = function(key) {
    const art = articleDatabase[key];
    if (!art) return;

    document.getElementById("page-content-target").innerHTML = `
        <div class="article-detail-header">
            <h2>${art.title}</h2>
        </div>

        <div class="article-info-grid">
            <div class="info-box">
                <div class="info-box-label">🏢 Mandated Agency</div>
                <div class="info-box-value">${art.dept}</div>
            </div>
            <div class="info-box emergency-box">
                <div class="info-box-label">⚡ Emergency Note</div>
                <div class="info-box-value">${art.emergency}</div>
            </div>
            <div class="info-box">
                <div class="info-box-label">☎️ Official Helpline</div>
                <div class="info-box-value"><a href="tel:${art.helpline}" class="helpline-link">${art.helpline}</a> (Free Call)</div>
            </div>
            <div class="info-box">
                <div class="info-box-label">🌐 Official Portal</div>
                <div class="info-box-value"><a href="${art.website}" target="_blank" class="portal-link">${art.websiteText} ↗</a></div>
            </div>
        </div>

        <h3 style="color:#102a43;margin:28px 0 16px;font-size:20px;">🗺️ Step-by-Step Complaint Roadmap</h3>
        <div class="article-steps-block">${art.steps}</div>

        <h3 style="color:#102a43;margin:28px 0 16px;font-size:20px;">✉️ Ready-to-Use Complaint Template</h3>
        <div class="template-copy-wrapper">
            <button class="copy-template-btn" onclick="copyTemplate('template-text-${key}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy Template
            </button>
            <div id="template-text-${key}" class="blueprint-box">${art.template}</div>
        </div>
    `;

    const page = document.getElementById("articlePage");
    page.style.display = "block";
    document.body.style.overflow = "hidden";
    page.scrollTop = 0;
};

window.closeArticlePage = function() {
    const page = document.getElementById("articlePage");
    page.style.display = "none";
    document.body.style.overflow = "auto";
};

window.copyTemplate = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const text = el.innerText;
    navigator.clipboard.writeText(text).then(() => {
        const btn = el.previousElementSibling;
        btn.innerText = "✓ Copied!";
        btn.style.background = "#138808";
        setTimeout(() => {
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>Copy Template`;
            btn.style.background = "";
        }, 2000);
    }).catch(() => alert("Copy failed — please select and copy the text manually."));
};

// ==========================================================================
// 18. RESET STATE
// ==========================================================================
function returnToHomeState() {
    document.getElementById("complaint").value = "";
    attachedImagesBase64 = [];
    renderThumbnails();
    const sd = document.getElementById("solution-desk");
    const lp = document.getElementById("letter-panel");
    if (sd) sd.style.display = "none";
    if (lp) lp.style.display = "none";
    document.getElementById("home").scrollIntoView({ behavior: "smooth" });
}