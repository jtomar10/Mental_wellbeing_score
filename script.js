/* =========================================================
   STUDENT MENTAL HEALTH SCORER — APP LOGIC
   API contract: POST /predict -> { predicted_mental_health_score: number }
   Model output is 0–10.
   ========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000";
const PREDICT_URL = `${API_BASE_URL}/predict`;
const HEALTH_URL = `${API_BASE_URL}/health`;

const MODEL_SCORE_MIN = 0;
const MODEL_SCORE_MAX = 10;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const form = $("#assessmentForm");
const submitBtn = $("#submitBtn");
const btnLabel = submitBtn?.querySelector(".btn-label");
const btnSpinner = submitBtn?.querySelector(".btn-spinner");
const btnArrow = submitBtn?.querySelector(".btn-arrow");
const apiErrorBox = $("#apiError");

const countrySelect = $("#country");
const countryOther = $("#countryOther");
const stressGroup = $("#stressLevelGroup");
const stressInput = $("#stress_level");

const completionText = $("#completionText");
const completionBar = $("#completionBar");

const resultSection = $("#resultSection");
const scoreValueEl = $("#scoreValue");
const meterProgress = $("#meterProgress");
const meterNeedle = $("#meterNeedle");
const resultBadge = $("#resultBadge");
const reflectionIcon = $("#reflectionIcon");
const reflectionTitle = $("#reflectionTitle");
const resultExplainer = $("#resultExplainer");
const selectedStressValue = $("#selectedStressValue");
const selectedStressFill = $("#selectedStressFill");
const stressMessage = $("#stressMessage");
const nextStepText = $("#nextStepText");
const factorStripSummary = $("#factorStripSummary");
const resetBtn = $("#resetBtn");
const editAssessmentBtn = $("#editAssessmentBtn");
const copyResultBtn = $("#copyResultBtn");
const toast = $("#toast");

const modelStatus = $("#modelStatus");
const modelStatusText = $("#modelStatusText");

const sliders = [
  "avg_daily_usage_hours",
  "study_hours",
  "physical_activity_hours",
  "sleep_hours_per_night",
];

/* ---------- initialization ---------- */

document.addEventListener("DOMContentLoaded", () => {
  sliders.forEach((id) => {
    const slider = document.getElementById(id);
    if (!slider) return;

    const output = slider.parentElement?.parentElement?.querySelector(".slider-value")
      || slider.closest(".field")?.querySelector(".slider-value");

    if (output) {
      updateSliderVisual(slider, output);
      slider.addEventListener("input", () => updateSliderVisual(slider, output));
    }
  });

  stressGroup?.querySelectorAll(".segmented-btn").forEach((button) => {
    button.addEventListener("click", () => selectStress(button));
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const buttons = [...stressGroup.querySelectorAll(".segmented-btn")];
      const index = buttons.indexOf(button);
      const nextIndex =
        event.key === "ArrowRight"
          ? (index + 1) % buttons.length
          : (index - 1 + buttons.length) % buttons.length;
      buttons[nextIndex].focus();
      selectStress(buttons[nextIndex]);
      event.preventDefault();
    });
  });

  countrySelect?.addEventListener("change", handleCountryChange);

  form?.addEventListener("input", updateCompletion);
  form?.addEventListener("change", updateCompletion);
  updateCompletion();

  initializeMeter();
  checkModelHealth();

  // Prevent a partially-scrolled result from remaining hidden on reload.
  window.addEventListener("pageshow", () => updateCompletion());
});

/* ---------- model status ---------- */

async function checkModelHealth() {
  setModelStatus("checking", "Checking model…");

  try {
    const response = await fetch(HEALTH_URL, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) throw new Error("Health check failed");

    const body = await response.json().catch(() => ({}));

    if (body?.status === "ok") {
      setModelStatus("online", "AI Model Online");
    } else {
      setModelStatus("online", "Prediction API Ready");
    }
  } catch {
    setModelStatus("offline", "API Offline");
  }
}

function setModelStatus(state, label) {
  modelStatus?.classList.remove("status-pill--checking", "status-pill--offline");

  if (state === "checking") modelStatus?.classList.add("status-pill--checking");
  if (state === "offline") modelStatus?.classList.add("status-pill--offline");

  if (modelStatusText) modelStatusText.textContent = label;
}

/* ---------- sliders ---------- */

function updateSliderVisual(slider, output) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const value = Number(slider.value);
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  slider.style.setProperty("--fill", `${pct}%`);
  output.textContent = `${value.toFixed(1)} h`;
}

/* ---------- country ---------- */

function handleCountryChange() {
  const isOther = countrySelect?.value === "Other";

  if (!countryOther) return;

  countryOther.hidden = !isOther;
  countryOther.required = isOther;

  if (!isOther) countryOther.value = "";
  updateCompletion();
}

/* ---------- stress ---------- */

function selectStress(button) {
  if (!stressGroup || !stressInput) return;

  stressGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
    const active = btn === button;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  });

  stressInput.value = button.dataset.value || "";
  clearFieldError("stress_level");
  updateCompletion();
}

/* ---------- progress ---------- */

function updateCompletion() {
  const checks = [
    $("#age")?.value.trim(),
    $("#gender")?.value,
    $("#country")?.value,
    $("#academic_level")?.value,
    $("#most_used_platform")?.value,
    $("#purpose_of_use")?.value,
    $("#daily_unlocks")?.value.trim(),
    $("#stress_level")?.value,
  ];

  const selectedSliders = sliders.map((id) => document.getElementById(id)?.value);
  const allAnswered = [...checks, ...selectedSliders].filter((value) => value !== undefined && value !== null);
  const answered = allAnswered.filter((value) => String(value).trim() !== "").length;
  const total = allAnswered.length || 1;
  const percent = Math.round((answered / total) * 100);

  if (completionText) completionText.textContent = `${percent}%`;
  if (completionBar) completionBar.style.width = `${percent}%`;
}

/* ---------- errors ---------- */

function setFieldError(name, message) {
  const errorEl = document.querySelector(`[data-error-for="${name}"]`);
  if (!errorEl) return;

  errorEl.textContent = message || "";
  const field = errorEl.closest(".field, .stress-panel");

  if (field) {
    field.classList.toggle("has-error", Boolean(message));
  }
}

function clearFieldError(name) {
  setFieldError(name, "");
}

function clearAllErrors() {
  $$(".field-error").forEach((element) => {
    element.textContent = "";
  });

  $$(".field, .stress-panel").forEach((element) => {
    element.classList.remove("has-error");
  });

  hideApiError();
}

function showApiError(message) {
  if (!apiErrorBox) return;
  apiErrorBox.textContent = message;
  apiErrorBox.hidden = false;
}

function hideApiError() {
  if (!apiErrorBox) return;
  apiErrorBox.hidden = true;
  apiErrorBox.textContent = "";
}

/* ---------- collect + validate ---------- */

function validateAndCollect() {
  clearAllErrors();

  let valid = true;

  const age = Number($("#age")?.value);
  if (!Number.isInteger(age) || age < 10 || age > 100) {
    setFieldError("age", "Enter an age between 10 and 100.");
    valid = false;
  }

  const gender = $("#gender")?.value;
  if (!gender) {
    setFieldError("gender", "Please select a gender.");
    valid = false;
  }

  const countryChoice = countrySelect?.value;
  let country = countryChoice || "";

  if (!countryChoice) {
    setFieldError("country", "Please select a country.");
    valid = false;
  } else if (countryChoice === "Other") {
    country = countryOther?.value.trim() || "";
    if (!country) {
      setFieldError("country", "Please enter your country.");
      valid = false;
    }
  }

  const academic_level = $("#academic_level")?.value;
  if (!academic_level) {
    setFieldError("academic_level", "Please select an academic level.");
    valid = false;
  }

  const most_used_platform = $("#most_used_platform")?.value;
  if (!most_used_platform) {
    setFieldError("most_used_platform", "Please select a platform.");
    valid = false;
  }

  const purpose_of_use = $("#purpose_of_use")?.value;
  if (!purpose_of_use) {
    setFieldError("purpose_of_use", "Please select a purpose.");
    valid = false;
  }

  const avg_daily_usage_hours = getNumber("avg_daily_usage_hours");
  if (!isInRange(avg_daily_usage_hours, 0, 24)) {
    setFieldError("avg_daily_usage_hours", "Choose a value between 0 and 24 hours.");
    valid = false;
  }

  const daily_unlocks = getNumber("daily_unlocks");
  if (!Number.isInteger(daily_unlocks) || daily_unlocks < 0 || daily_unlocks > 500) {
    setFieldError("daily_unlocks", "Enter a whole number from 0 to 500.");
    valid = false;
  }

  const study_hours = getNumber("study_hours");
  if (!isInRange(study_hours, 0, 24)) {
    setFieldError("study_hours", "Choose a value between 0 and 24 hours.");
    valid = false;
  }

  const physical_activity_hours = getNumber("physical_activity_hours");
  if (!isInRange(physical_activity_hours, 0, 24)) {
    setFieldError("physical_activity_hours", "Choose a value between 0 and 24 hours.");
    valid = false;
  }

  const sleep_hours_per_night = getNumber("sleep_hours_per_night");
  if (!isInRange(sleep_hours_per_night, 0, 24)) {
    setFieldError("sleep_hours_per_night", "Choose a value between 0 and 24 hours.");
    valid = false;
  }

  const stress_level = stressInput?.value;
  const allowedStress = new Set(["Low", "Medium", "High", "Very High"]);

  if (!allowedStress.has(stress_level)) {
    setFieldError("stress_level", "Please choose a stress level.");
    valid = false;
  }

  if (!valid) {
    return { valid: false, payload: null };
  }

  return {
    valid: true,
    payload: {
      age,
      gender,
      country,
      academic_level,
      most_used_platform,
      purpose_of_use,
      avg_daily_usage_hours,
      daily_unlocks,
      study_hours,
      physical_activity_hours,
      sleep_hours_per_night,
      stress_level,
    },
  };
}

function getNumber(id) {
  const raw = document.getElementById(id)?.value;
  return raw === "" ? NaN : Number(raw);
}

function isInRange(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

/* ---------- submission ---------- */

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const { valid, payload } = validateAndCollect();

  if (!valid) {
    const firstError = $(".has-error");
    firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  setLoading(true);
  hideApiError();

  try {
    setModelStatus("checking", "Calculating score…");

    const response = await fetch(PREDICT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let detail = "The prediction server could not process this assessment.";

      try {
        const errorBody = await response.json();
        if (typeof errorBody?.detail === "string") {
          detail = errorBody.detail;
        }
      } catch {
        // Keep generic message.
      }

      throw new Error(detail);
    }

    const data = await response.json();
    const rawScore = Number(data?.predicted_mental_health_score);

    if (!Number.isFinite(rawScore)) {
      throw new Error("The prediction API returned an invalid score.");
    }

    setModelStatus("online", "AI Model Online");
    renderResult(rawScore, payload);
  } catch (error) {
    const networkError = error instanceof TypeError;

    if (networkError) {
      showApiError(
        "Couldn't reach FastAPI. Start the backend at 127.0.0.1:8000 and try again."
      );
      setModelStatus("offline", "API Offline");
    } else {
      showApiError(error.message || "Something went wrong while generating the score.");
      setModelStatus("offline", "API Error");
    }
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  if (!submitBtn) return;

  submitBtn.disabled = isLoading;
  if (btnSpinner) btnSpinner.hidden = !isLoading;
  if (btnArrow) btnArrow.hidden = isLoading;

  if (btnLabel) {
    btnLabel.textContent = isLoading
      ? "Analyzing your responses…"
      : "Generate my wellbeing score";
  }
}

/* ---------- result ---------- */

function renderResult(rawScore, payload) {
  const score = clamp(rawScore, MODEL_SCORE_MIN, MODEL_SCORE_MAX);
  const interpretation = getScoreInterpretation(score);

  resultSection.hidden = false;

  updateScoreVisuals(score, interpretation);
  renderInterpretation(score, payload, interpretation);
  renderSummary(payload);
  renderStressMessage(payload.stress_level);

  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });

  // Let the score animation render after the result becomes visible.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => animateScore(score));
  });
}

function initializeMeter() {
  if (!meterProgress || !meterNeedle) return;

  meterProgress.style.strokeDashoffset = "100";
  meterNeedle.style.transform = "rotate(-90deg)";
}

function updateScoreVisuals(score, interpretation) {
  const pct = ((score - MODEL_SCORE_MIN) / (MODEL_SCORE_MAX - MODEL_SCORE_MIN)) * 100;

  if (meterProgress) {
    meterProgress.style.strokeDashoffset = String(100 - pct);
  }

  if (meterNeedle) {
    // -90deg = far left, +90deg = far right around the center pivot.
    const angle = -90 + (pct / 100) * 180;
    meterNeedle.style.transform = `rotate(${angle}deg)`;
  }

  if (resultBadge) {
    resultBadge.textContent = interpretation.label;
    resultBadge.className = `result-badge ${interpretation.className || ""}`.trim();
  }

  if (reflectionIcon) reflectionIcon.textContent = interpretation.icon;
}

function animateScore(target) {
  if (!scoreValueEl) return;

  const start = 0;
  const duration = 1050;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;

    scoreValueEl.textContent = current.toFixed(2);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      scoreValueEl.textContent = target.toFixed(2);
    }
  }

  requestAnimationFrame(tick);
}

function getScoreInterpretation(score) {
  // These are intentionally descriptive model ranges, not clinical categories.
  if (score >= 7.5) {
    return {
      label: "Higher score range",
      className: "good",
      icon: "✦",
      title: "A stronger wellbeing snapshot",
      description:
        "Your model-estimated score sits in the higher part of the 0–10 scale. The routine you entered contains a generally favorable mix of the factors included in this model.",
      nextStep:
        "Notice which parts of your current routine feel sustainable and protect those habits during busy periods.",
    };
  }

  if (score >= 5.5) {
    return {
      label: "Balanced score range",
      className: "moderate",
      icon: "◐",
      title: "A fairly balanced snapshot",
      description:
        "Your model-estimated score sits around the middle-to-higher part of the scale. There may be a useful balance here, with a few areas worth keeping an eye on.",
      nextStep:
        "Look for one small routine change that could make an already workable day feel easier to maintain.",
    };
  }

  if (score >= 3.5) {
    return {
      label: "Needs-attention range",
      className: "moderate",
      icon: "△",
      title: "A routine worth reflecting on",
      description:
        "Your model-estimated score falls in a lower-middle portion of the 0–10 scale. Consider the result a prompt to look more closely at the habits represented in your answers.",
      nextStep:
        "Start with one practical area—sleep, movement, digital habits, study rhythm, or stress—and make one manageable change.",
    };
  }

  return {
    label: "Lower score range",
    className: "low",
    icon: "•",
    title: "A lower wellbeing snapshot",
    description:
      "Your model-estimated score falls toward the lower end of the 0–10 scale. That does not diagnose a condition, but it may be useful to pause and look at the routine factors represented here.",
    nextStep:
      "Choose one small, realistic routine improvement and consider talking with a trusted person if you have been finding things difficult.",
  };
}

function renderInterpretation(score, payload, interpretation) {
  if (reflectionTitle) reflectionTitle.textContent = interpretation.title;
  if (resultExplainer) resultExplainer.textContent = interpretation.description;
  if (nextStepText) nextStepText.textContent = interpretation.nextStep;

  const confidence = score >= 7.5
    ? "Descriptive range • higher"
    : score >= 5.5
      ? "Descriptive range • balanced"
      : score >= 3.5
        ? "Descriptive range • needs attention"
        : "Descriptive range • lower";

  const confidenceNote = $("#confidenceNote");
  if (confidenceNote) confidenceNote.textContent = `${confidence} • model score 0–10`;
}

function renderStressMessage(stress) {
  const stressLevels = {
    Low: {
      pct: 18,
      message:
        "You selected a lower stress level. In the model input, this is the first stress category and is treated differently from the higher levels.",
    },
    Medium: {
      pct: 44,
      message:
        "You selected a medium stress level. Keep an eye on whether pressure is affecting your sleep, study rhythm, movement, or digital habits.",
    },
    High: {
      pct: 72,
      message:
        "You selected a high stress level. The result should be read alongside the rest of your routine rather than in isolation.",
    },
    "Very High": {
      pct: 94,
      message:
        "You selected a very high stress level. Consider this an especially useful prompt to pause, identify what is creating pressure, and reach out for support when needed.",
    },
  };

  const info = stressLevels[stress] || { pct: 0, message: "" };

  if (selectedStressValue) selectedStressValue.textContent = stress || "—";
  if (selectedStressFill) selectedStressFill.style.width = `${info.pct}%`;
  if (stressMessage) stressMessage.textContent = info.message;
}

/* ---------- summary ---------- */

function renderSummary(payload) {
  const items = [
    { icon: "icon-sleep", label: "Sleep", value: `${formatHours(payload.sleep_hours_per_night)} h / night` },
    { icon: "icon-study", label: "Study", value: `${formatHours(payload.study_hours)} h / day` },
    { icon: "icon-activity", label: "Movement", value: `${formatHours(payload.physical_activity_hours)} h / day` },
    {
      icon: "icon-digital",
      label: "Digital usage",
      value: `${formatHours(payload.avg_daily_usage_hours)} h · ${payload.daily_unlocks} unlocks`,
    },
    { icon: "icon-stress", label: "Stress", value: payload.stress_level },
  ];

  if (!factorStripSummary) return;

  factorStripSummary.innerHTML = items.map((item) => `
    <div class="factor-card">
      <span class="factor-icon ${item.icon}" aria-hidden="true"></span>
      <span class="factor-label">${escapeHTML(item.label)}</span>
      <span class="factor-value">${escapeHTML(item.value)}</span>
    </div>
  `).join("");
}

function formatHours(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : "0.0";
}

/* ---------- reset / edit ---------- */

resetBtn?.addEventListener("click", resetAssessment);
editAssessmentBtn?.addEventListener("click", () => {
  $("#assessment")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

function resetAssessment() {
  form?.reset();
  clearAllErrors();

  stressInput.value = "";
  stressGroup?.querySelectorAll(".segmented-btn").forEach((button) => {
    button.classList.remove("active");
    button.setAttribute("aria-checked", "false");
  });

  countryOther.hidden = true;
  countryOther.required = false;
  countryOther.value = "";

  sliders.forEach((id) => {
    const slider = document.getElementById(id);
    if (!slider) return;

    const output = slider.parentElement?.parentElement?.querySelector(".slider-value")
      || slider.closest(".field")?.querySelector(".slider-value");

    if (output) updateSliderVisual(slider, output);
  });

  if (resultSection) resultSection.hidden = true;

  initializeMeter();
  if (scoreValueEl) scoreValueEl.textContent = "0.00";

  updateCompletion();
  setModelStatus("checking", "Checking model…");
  checkModelHealth();

  $("#assessment")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- copy result ---------- */

copyResultBtn?.addEventListener("click", async () => {
  const score = scoreValueEl?.textContent || "0.00";
  const stress = selectedStressValue?.textContent || "—";
  const badge = resultBadge?.textContent || "Model estimate";
  const title = reflectionTitle?.textContent || "Wellbeing snapshot";

  const summary =
`Student Mental Health Scorer
Score: ${score} / 10
Range: ${badge}
Stress selected: ${stress}
${title}

This is an AI/model-based estimate for academic/self-reflection use, not a medical diagnosis.`;

  try {
    await navigator.clipboard.writeText(summary);
    showToast("Result summary copied.");
  } catch {
    showToast("Copy is unavailable in this browser.");
  }
});

/* ---------- utilities ---------- */

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let toastTimer = null;

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}
