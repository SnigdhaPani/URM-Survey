// pages/index.jsx
import { useEffect, useRef, useState } from "react";

const QUESTIONS_URL = "/data/questions.json"; // ensure public/data/questions.json exists

const VIDEO_MAP = {
  CE: { code: "CE", yt: "https://www.youtube.com/watch?v=CsCqkkjF-8E", moreInfo: "https://www.sansaar.co.in/products" },
  AC: { code: "AC", yt: "http://youtube.com/shorts/cixvzLa0d1c", moreInfo: "https://www.amazon.in/stores/BIC-Cello/page/A84B777B-6C4A-43D2-9A96-0C8FF334DA33" },
  PP: { code: "PP", yt: "https://www.youtube.com/watch?v=1ihGeitBI_4&t=42s", moreInfo: "https://www.mi.com/in/product-list/tv/?srsltid=AfmBOoqXmnHU1VFFP7Jb4GlY_eZBIpR7m_fKcfu7A2cSsXdMo20mUkm5" },
  BT: { code: "BT", yt: "https://www.youtube.com/watch?v=LcGPI2tV2yY", moreInfo: "https://www.apple.com/in/" },
  ST: { code: "ST", yt: "https://www.youtube.com/watch?v=JDk3GQkTyN4&list=PLXLT0cAAZyduzk5U5a43xdgrZY6fBCjMN&index=37", moreInfo: "https://havells.com/home-electricals/flexible-cables.html" }
};

const LIKERT = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

function extractYouTubeID(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.searchParams.has("v")) return u.searchParams.get("v");
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  } catch {
    const m = url.match(/v=([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
}

function secureRandomIndex(max) {
  // Use crypto.getRandomValues for better randomness
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export default function SurveyPage() {
  const [stage, setStage] = useState("consent"); // consent, demographics, video, questions, complete, exit
  const [consent, setConsent] = useState(null);

  const [ageGroup, setAgeGroup] = useState(null);
  const [gender, setGender] = useState(null);

  const [questionsByType, setQuestionsByType] = useState(null);
  const [assignedType, setAssignedType] = useState(null);
  const [assignedAd, setAssignedAd] = useState(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [clickedMoreInfo, setClickedMoreInfo] = useState(false);

  const ytRef = useRef(null);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [watchSeconds, setWatchSeconds] = useState(null);

  const [participantId] = useState("p_" + Math.random().toString(36).slice(2, 9));
  const [completionCode, setCompletionCode] = useState(null);

  // Load questions.json once
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const r = await fetch(QUESTIONS_URL, { cache: "no-store" });
        const json = await r.json();
        if (mounted) setQuestionsByType(json);
      } catch (e) {
        console.error("Failed to load questions.json", e);
        setQuestionsByType({ CE: [], AC: [], PP: [], BT: [], ST: [] });
      }
    }
    load();
    return () => (mounted = false);
  }, []);

  // Consent continue
  function handleConsentContinue() {
    if (consent === null) {
      alert("Please indicate if you agree to participate.");
      return;
    }
    if (!consent) {
      setStage("exit");
      return;
    }
    setStage("demographics");
  }

  // Start experiment (choose random ad only AFTER questions loaded)
  function startExperiment() {
    if (!ageGroup || !gender) {
      alert("Please complete demographics.");
      return;
    }
    if (!questionsByType) {
      alert("Loading questions — please wait a moment.");
      return;
    }

    const keys = Object.keys(VIDEO_MAP);
    const idx = secureRandomIndex(keys.length);
    const chosen = keys[idx];
    setAssignedType(chosen);
    setAssignedAd(VIDEO_MAP[chosen]);
    console.log("Assigned ad code:", chosen); // DEBUG: remove for production
    setStage("video");
    setTimeout(() => initYouTube(VIDEO_MAP[chosen].yt), 250);
  }

  async function initYouTube(url) {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      await new Promise((res) => {
        const t = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(t);
            res();
          }
        }, 100);
      });
    }

    try {
      if (ytRef.current && ytRef.current.destroy) {
        ytRef.current.destroy();
        ytRef.current = null;
      }
    } catch {}

    const vid = extractYouTubeID(url);
    if (!vid) {
      console.error("Bad YT url", url);
      return;
    }

    ytRef.current = new window.YT.Player("yt-player", {
      height: "380",
      width: "720",
      videoId: vid,
      playerVars: { rel: 0, modestbranding: 1 },
      events: {
        onReady: (e) => {
          try {
            e.target.playVideo();
            setStartTime(new Date().toISOString());
          } catch {}
        },
        onStateChange: (e) => {
          if (e.data === 0) {
            const end = new Date().toISOString();
            setEndTime(end);
            let secs = null;
            try {
              secs = Math.round(ytRef.current.getCurrentTime());
            } catch {}
            setWatchSeconds(secs);
            setStage("questions");
            setCurrentQuestionIndex(0);
            setAnswers({});
            setClickedMoreInfo(false);
          }
        }
      }
    });
  }

  function handleMoreInfoClick() {
    setClickedMoreInfo(true);
    if (assignedAd?.moreInfo) {
      window.open(assignedAd.moreInfo, "_blank", "noopener");
    }
  }

  function setAnswer(qIndex, numeric) {
    setAnswers((prev) => ({ ...prev, [qIndex]: numeric }));
  }

  function handleNextQuestion() {
    const qList = questionsByType?.[assignedType] || [];
    if (answers[currentQuestionIndex] === undefined) {
      alert("Please select an answer to proceed.");
      return;
    }
    if (currentQuestionIndex < qList.length - 1) {
      setCurrentQuestionIndex((v) => v + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handlePreviousQuestion() {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((v) => v - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleSubmit() {
    const qList = questionsByType?.[assignedType] || [];
    // Ensure all questions answered before submit
    for (let i = 0; i < qList.length; i++) {
      if (answers[i] === undefined) {
        alert(`Please answer question ${i + 1} before submitting.`);
        setCurrentQuestionIndex(i);
        return;
      }
    }

    const responsesObj = {};
    qList.forEach((q, i) => {
      const v = answers[i] ?? null;
      responsesObj[q] = v !== null ? { numeric: v, text: LIKERT[v - 1] } : { numeric: null, text: null };
    });

    const payload = {
      participantId,
      consent,
      ageGroup,
      gender,
      assignedAdCode: assignedType,
      assignedAdURL: assignedAd?.yt ?? null,
      startTime,
      endTime,
      watchSeconds,
      clickedMoreInfo,
      moreInfoURL: assignedAd?.moreInfo ?? null,
      responses: responsesObj,
      timestamp: new Date().toISOString()
    };

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Submit failed");
      setCompletionCode(data.completionCode || null);
      setStage("complete");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Submit error:", err);
      alert("Submission failed: " + (err.message || "unknown error"));
    }
  }

  // Derived values
  const qList = questionsByType?.[assignedType] || [];
  const totalQuestions = qList.length;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  return (
    <div className="page">
      <div className="container">
        <header className="header">
          <h1>Ad Response Survey</h1>
          <p className="sub">Watch one short video and answer a few questions. Estimated time: 10–15 minutes.</p>
        </header>

        <ProgressBar stage={stage} currentQ={currentQuestionIndex} totalQ={totalQuestions} />

        {stage === "consent" && (
          <div className="card">
            <h2>PARTICIPANT CONSENT FORM</h2>
            <p><strong>Study Title:</strong> Understanding Audience Responses to Different Advertisements</p>
            <p><strong>Researchers:</strong> Snigdha Pani, Deepti Koranga, Prakash Bhabad — IIIT Hyderabad</p>

            <section className="consent-text">
              <h3>Purpose of the Study</h3>
              <p>You are invited to take part in this study. The purpose is to understand how people perceive and respond to different types of advertisements. We are interested in learning what aspects viewers notice, how they interpret the content, and how these elements shape their general impressions of the brands or products shown. This study does not test your knowledge or performance — we are only interested in your natural reactions and opinions.</p>

              <h3>What Participation Involves</h3>
              <ol>
                <li>View a short advertisement video.</li>
                <li>Answer questions about your impressions, feelings, and reactions.</li>
                <li>Provide honest and voluntary feedback based on your experience.</li>
                <li>The estimated time to complete the study is 10–15 minutes.</li>
              </ol>

              <h3>Privacy & Withdrawal</h3>
              <p>Your responses are anonymous. You may withdraw at any time without penalty.</p>
            </section>

            <div className="consent-actions">
              <label className="radio"><input type="radio" name="consent" onChange={() => setConsent(true)} /> I Agree to participate in this study</label>
              <label className="radio"><input type="radio" name="consent" onChange={() => setConsent(false)} /> I Do Not Agree</label>
            </div>

            <div className="card-actions">
              <button className="btn primary" onClick={handleConsentContinue} disabled={consent === null}>Continue</button>
              <button className="btn ghost" onClick={() => { setConsent(false); setStage("exit"); }}>Decline</button>
            </div>
          </div>
        )}

        {stage === "exit" && (
          <div className="card centered">
            <h2>Thank you</h2>
            <p>Thank you for your time.</p>
          </div>
        )}

        {stage === "demographics" && (
          <div className="card">
            <h2>Demographics</h2>

            <div className="form-row">
              <label className="label">Age group</label>
              <div className="radios">
                <label className="radio-inline"><input type="radio" name="age" onChange={() => setAgeGroup("18-25")} /> 18–25</label>
                <label className="radio-inline"><input type="radio" name="age" onChange={() => setAgeGroup("26-35")} /> 26–35</label>
              </div>
            </div>

            <div className="form-row">
              <label className="label">Gender</label>
              <div className="radios">
                <label className="radio-inline"><input type="radio" name="gen" onChange={() => setGender("Male")} /> Male</label>
                <label className="radio-inline"><input type="radio" name="gen" onChange={() => setGender("Female")} /> Female</label>
                <label className="radio-inline"><input type="radio" name="gen" onChange={() => setGender("Other")} /> Other</label>
                <label className="radio-inline"><input type="radio" name="gen" onChange={() => setGender("Prefer not to say")} /> Prefer not to say</label>
              </div>
            </div>

            <div className="card-actions">
              <button className="btn primary" onClick={startExperiment} disabled={!ageGroup || !gender}>Start</button>
            </div>
          </div>
        )}

        {stage === "video" && assignedAd && (
          <div className="card">
            <h2>Please watch the video</h2>
            <div id="yt-player" style={{ display: "flex", justifyContent: "center" }} />
            <p className="muted small">Questions will appear after the video ends. Please watch the full video.</p>
            {/* <div style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={() => { setClickedMoreInfo(true); window.open(assignedAd.moreInfo, "_blank", "noopener"); }}>Open product information (optional)</button>
            </div> */}
          </div>
        )}

        {stage === "questions" && (
          <div className="card">
            <h3 className="muted small" style={{marginBottom:12}}>Please answer the following</h3>

            <div className="single-question">
              <div className="q-text-large">{qList[currentQuestionIndex]}</div>

              <div className="q-choices-vertical">
                {LIKERT.map((label, li) => (
                  <label key={li} className={`choice-large ${answers[currentQuestionIndex] === li+1 ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name={`q-${currentQuestionIndex}`}
                      checked={answers[currentQuestionIndex] === li + 1}
                      onChange={() => setAnswer(currentQuestionIndex, li + 1)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              {/* More-info ONLY on last question & placed next to question (styled below) */}
              {/* {isLastQuestion && (
                <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12 }}>
                  <button className="btn link" onClick={handleMoreInfoClick}>More information about the product</button>
                  {assignedAd && <a className="more-link" href={assignedAd.moreInfo} target="_blank" rel="noreferrer">{assignedAd.moreInfo}</a>}
                </div>
              )} */}
              {isLastQuestion && (
  <div style={{ marginTop: 18 }}>
    <button className="btn link" onClick={handleMoreInfoClick}>
      More information
    </button>
  </div>
)}

            </div>

            <div className="card-actions" style={{ justifyContent: "space-between" }}>
              <div>
                {currentQuestionIndex > 0 && <button className="btn ghost" onClick={handlePreviousQuestion}>Previous</button>}
              </div>

              <div>
                {!isLastQuestion ? (
                  <button className="btn primary" onClick={handleNextQuestion} disabled={answers[currentQuestionIndex] === undefined}>Next</button>
                ) : (
                  <button className="btn primary" onClick={handleSubmit}>Submit</button>
                )}
              </div>
            </div>
          </div>
        )}

        {stage === "complete" && (
          <div className="card centered">
            <h2>Thank you!</h2>
            <p>Your responses have been recorded.</p>
            {completionCode && <div className="completion"><strong>Completion code:</strong> <code>{completionCode}</code><p className="muted small">Copy this code if needed.</p></div>}
          </div>
        )}

        <footer className="footer">
          <small>IIIT Hyderabad — Ad Response Study</small>
        </footer>
      </div>

      <style jsx>{`
        :root{--bg:#f6f8fb;--card:#fff;--muted:#6b7280;--primary:#0f62fe;--accent:#7c3aed;}
        .page{min-height:100vh;background:linear-gradient(180deg,#f7fbff 0%,var(--bg)100%);padding:28px 16px;}
        .container{max-width:980px;margin:0 auto;font-family:Inter,system-ui,Arial;color:#111827}
        .header{text-align:center;margin-bottom:10px}
        .header h1{margin:0;font-size:28px}
        .sub{color:var(--muted);margin-top:6px}
        .card{background:var(--card);border-radius:12px;box-shadow:0 8px 30px rgba(15,23,42,0.06);padding:22px;margin:18px 0;border:1px solid rgba(15,23,42,0.03)}
        .card.centered{text-align:center}
        .consent-text p,.consent-text ul{color:var(--muted);line-height:1.5}
        .consent-actions{display:flex;flex-direction:column;gap:12px;margin-top:12px}
        .card-actions{margin-top:18px;display:flex;gap:12px;align-items:center}
        .btn{padding:10px 16px;border-radius:10px;border:none;cursor:pointer;font-weight:700;background:transparent;font-size:14px}
        
        .btn.primary {
  background: #0f62fe !important;
  color: #ffffff !important;
  display: inline-block !important;
  font-weight: 700 !important;
}

        .btn.ghost{border:1px solid rgba(15,23,42,0.08);background:transparent;color:#111827}
        .btn.link{text-decoration:underline;background:transparent;color:var(--accent);font-weight:700;padding:8px 10px}
        .btn:disabled{opacity:0.5;cursor:not-allowed}
        .muted{color:var(--muted)}
        .small{font-size:13px}
        .label{font-weight:700;margin-bottom:8px;display:block}
        .radios{display:flex;gap:18px;flex-wrap:wrap}
        .radio-inline{display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600}
        .form-row{margin:14px 0}
        .single-question{padding:18px;border-radius:12px;background:linear-gradient(180deg,#fff,#fbfdff);border:1px solid rgba(2,6,23,0.04)}
        .q-text-large{font-size:18px;font-weight:700;margin-bottom:18px;line-height:1.4;color:#111827}
        .q-choices-vertical{display:flex;flex-direction:column;gap:12px}
        .choice-large{display:flex;align-items:center;gap:14px;padding:12px 14px;border-radius:10px;border:1px solid rgba(15,23,42,0.06);cursor:pointer;background:#fff;transition:all 0.15s ease}
        .choice-large.selected{border-color:var(--primary);background:#f6fbff}
        .choice-large input{transform:scale(1.15);cursor:pointer}
        .choice-large span{font-size:15px;color:#374151;font-weight:600}
        .more-link{margin-left:10px;color:var(--muted);font-size:13px;text-decoration:underline}
        footer.footer{text-align:center;color:var(--muted);margin-top:14px}
        .completion{margin-top:12px;padding:12px;background:#f3f6ff;border-radius:8px;border:1px solid rgba(15,98,254,0.06);text-align:center}
        .completion code{background:#fff;padding:4px 8px;border-radius:6px;font-family:monospace}
        .progress{height:8px;background:rgba(2,6,23,0.05);border-radius:999px;margin:8px 0 16px;overflow:hidden}
        .progress-inner{height:100%;background:linear-gradient(90deg,var(--primary),var(--accent));width:0%;transition:width .6s ease}
        @media (max-width:720px){.container{padding:0 12px}.card{padding:16px}.choice-large{padding:10px}}
      `}</style>
    </div>
  );
}

function ProgressBar({ stage = "consent", currentQ = 0, totalQ = 1 }) {
  let pct = 0;
  if (stage === "consent") pct = 8;
  if (stage === "demographics") pct = 28;
  if (stage === "video") pct = 58;
  if (stage === "questions") {
    const questionProgress = totalQ > 0 ? ((currentQ + 1) / totalQ) * 40 : 0;
    pct = 58 + questionProgress;
  }
  if (stage === "complete") pct = 100;
  return (
    <div className="progress" aria-hidden>
      <div className="progress-inner" style={{ width: `${pct}%` }} />
    </div>
  );
}
