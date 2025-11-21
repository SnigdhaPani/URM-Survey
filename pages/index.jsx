// pages/index.jsx
import { useEffect, useRef, useState } from "react";

const QUESTIONS_URL = "/data/questions.json";

const VIDEO_MAP = {
  CE: {
    code: "CE",
    name: "Celebrity Endorsement",
    yt: "https://www.youtube.com/watch?v=CsCqkkjF-8E",
    moreInfo: "https://www.sansaar.co.in/products"
  },
  AC: {
    code: "AC",
    name: "Ad Creativity",
    yt: "http://youtube.com/shorts/cixvzLa0d1c",
    moreInfo: "https://www.amazon.in/stores/BIC-Cello/page/A84B777B-6C4A-43D2-9A96-0C8FF334DA33"
  },
  PP: {
    code: "PP",
    name: "Price Perception",
    yt: "https://www.youtube.com/watch?v=1ihGeitBI_4&t=42s",
    moreInfo: "https://www.mi.com/in/product-list/tv/?srsltid=AfmBOoqXmnHU1VFFP7Jb4GlY_eZBIpR7m_fKcfu7A2cSsXdMo20mUkm5"
  },
  BT: {
    code: "BT",
    name: "Brand Trust",
    yt: "https://www.youtube.com/watch?v=LcGPI2tV2yY",
    moreInfo: "https://www.apple.com/in/"
  },
  ST: {
    code: "ST",
    name: "Storytelling",
    yt: "https://www.youtube.com/watch?v=JDk3GQkTyN4&list=PLXLT0cAAZyduzk5U5a43xdgrZY6fBCjMN&index=37",
    moreInfo: "https://havells.com/home-electricals/flexible-cables.html"
  }
};

const LIKERT = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree"
];

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

export default function SurveyPage() {
  const [stage, setStage] = useState("consent");
  const [consent, setConsent] = useState(null);

  // demographics
  const [ageGroup, setAgeGroup] = useState(null);
  const [gender, setGender] = useState(null);

  // questions data
  const [questionsByType, setQuestionsByType] = useState({});
  const [assignedType, setAssignedType] = useState(null);
  const [assignedAd, setAssignedAd] = useState(null);

  // NEW: Current question index
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // youtube player
  const ytRef = useRef(null);

  // timing
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [watchSeconds, setWatchSeconds] = useState(null);

  // answers, more-info
  const [answers, setAnswers] = useState({});
  const [clickedMoreInfo, setClickedMoreInfo] = useState(false);

  // participant id & completion
  const [participantId] = useState("p_" + Math.random().toString(36).slice(2, 9));
  const [completionCode, setCompletionCode] = useState(null);

  // load questions.json
  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(QUESTIONS_URL);
        const json = await r.json();
        setQuestionsByType(json || {});
      } catch (err) {
        console.error("Failed to load questions.json", err);
      }
    }
    load();
  }, []);

  function handleConsentContinue() {
    if (consent === null) {
      alert("Please choose whether you agree to participate.");
      return;
    }
    if (!consent) {
      setStage("exit");
      return;
    }
    setStage("demographics");
  }

  function startExperiment() {
    if (!ageGroup || !gender) {
      alert("Please select age group and gender.");
      return;
    }
    const keys = Object.keys(VIDEO_MAP);
    const chosen = keys[Math.floor(Math.random() * keys.length)];
    setAssignedType(chosen);
    setAssignedAd(VIDEO_MAP[chosen]);
    setStage("video");
    setTimeout(() => initYT(VIDEO_MAP[chosen].yt), 300);
  }

  async function initYT(url) {
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
      console.error("Cannot extract youtube id", url);
      return;
    }

    ytRef.current = new window.YT.Player("yt-player", {
      height: "360",
      width: "640",
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
          }
        }
      }
    });
  }

  function handleMoreInfoClick() {
    setClickedMoreInfo(true);
    if (assignedAd && assignedAd.moreInfo) {
      window.open(assignedAd.moreInfo, "_blank", "noopener");
    }
  }

  function setAnswer(qIndex, numeric) {
    setAnswers((p) => ({ ...p, [qIndex]: numeric }));
  }

  // NEW: Handle next question
  function handleNextQuestion() {
    const qList = questionsByType[assignedType] || [];
    if (answers[currentQuestionIndex] === undefined) {
      alert("Please select an answer before proceeding.");
      return;
    }
    if (currentQuestionIndex < qList.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  }

  // NEW: Handle previous question
  function handlePreviousQuestion() {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  }

  async function handleSubmit() {
    const qList = questionsByType[assignedType] || [];
    
    // Check if current question is answered
    if (answers[currentQuestionIndex] === undefined) {
      alert("Please answer the current question before submitting.");
      return;
    }

    const responsesObj = {};
    qList.forEach((qText, idx) => {
      const v = answers[idx] ?? null;
      responsesObj[qText] = v !== null ? { numeric: v, text: LIKERT[v - 1] } : { numeric: null, text: null };
    });

    const payload = {
      participantId,
      consent,
      ageGroup,
      gender,
      assignedAdCode: assignedType,
      assignedAdURL: assignedAd ? assignedAd.yt : null,
      startTime,
      endTime,
      watchSeconds,
      clickedMoreInfo,
      moreInfoURL: assignedAd ? assignedAd.moreInfo : null,
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
    } catch (err) {
      console.error(err);
      alert("Failed to submit: " + err.message);
    }
  }

  const qList = questionsByType[assignedType] || [];
  const totalQuestions = qList.length;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  return (
    <div className="page">
      <div className="container">
        <header className="header">
          <h1>Ad Response Survey</h1>
          <p className="sub">You will watch one short video and answer questions about it. Estimated time: 10–15 minutes.</p>
        </header>

        <ProgressBar stage={stage} currentQ={currentQuestionIndex} totalQ={totalQuestions} />

        {stage === "consent" && (
          <div className="card">
            <h2>PARTICIPANT CONSENT FORM</h2>

            <p><strong>Study Title:</strong> Understanding Audience Responses to Different Advertisements</p>
            <p><strong>Researchers:</strong> Snigdha Pani, Deepti Koranga, Prakash Bhabad</p>
            <p><strong>Institution:</strong> IIIT Hyderabad</p>

            <h3>Purpose of the Study</h3>
            <p>You are invited to take part in this study. The purpose is to understand how people perceive and respond to different types of advertisements. We are interested in learning what aspects viewers notice, how they interpret the content, and how these elements shape their general impressions of the brands or products shown. This study does not test your knowledge or performance — we are only interested in your natural reactions and opinions.</p>

            <h3>What Participation Involves</h3>
            <ol>
              <li>View a short advertisement video.</li>
              <li>Answer questions about your impressions, feelings, and reactions.</li>
              <li>Provide honest and voluntary feedback based on your experience.</li>
              <li>The estimated time to complete the study is 10-15 minutes.</li>
            </ol>

            <h3>Voluntary Participation</h3>
            <p>Your participation is voluntary. You may stop at any time without penalty.</p>

            <h3>Privacy, Confidentiality & Data Use</h3>
            <ol>
              <li>Your identity will not be collected or linked to your responses.</li>
              <li>All information you provide will be kept confidential and used only for research purposes.</li>
              <li>Your responses will be stored securely and will not be shared or published in a way that identifies you.</li>
              <li>Data will not be used for any purpose outside this study.</li>
            </ol>

            <h3>Right to Withdraw</h3>
            <p>You may withdraw from the study at any time. If you withdraw, your responses will not be included in analysis.</p>

            <h3>Contact</h3>
            <p>Researcher: Prakash Bhabad — <a href="mailto:prakash.bhabad@students.iiit.ac.in">prakash.bhabad@students.iiit.ac.in</a></p>

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
              <label>Age group</label>
              <div>
                <label className="radio-inline"><input type="radio" name="age" onChange={() => setAgeGroup("18-25")} /> 18–25</label>
                <label className="radio-inline"><input type="radio" name="age" onChange={() => setAgeGroup("26-35")} /> 26–35</label>
              </div>
            </div>

            <div className="form-row">
              <label>Gender</label>
              <div>
                <label className="radio-inline"><input type="radio" name="gen" onChange={() => setGender("Male")} /> Male</label>
                <label className="radio-inline"><input type="radio" name="gen" onChange={() => setGender("Female")} /> Female</label>
                <label className="radio-inline"><input type="radio" name="gen" onChange={() => setGender("Other")} /> Other</label>
                <label className="radio-inline"><input type="radio" name="gen" onChange={() => setGender("Prefer not to say")} /> Prefer not to say</label>
              </div>
            </div>

            <div className="card-actions">
              <button className="btn primary" onClick={startExperiment} disabled={!ageGroup || !gender}>Start Video</button>
            </div>
          </div>
        )}

        {stage === "video" && assignedAd && (
          <div className="card">
            <h2>Now watching: {assignedAd.name}</h2>
            <div id="yt-player" style={{ display: "flex", justifyContent: "center" }}></div>
            <p className="muted small">Please watch the video fully. The questionnaire will appear after the video ends.</p>

            <div style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={handleMoreInfoClick}>Open product information (optional)</button>
              <span style={{ marginLeft: 12 }}>{clickedMoreInfo ? "Opened" : "Optional"}</span>
            </div>
          </div>
        )}

        {stage === "questions" && (
          <div className="card">
            <h2>Question {currentQuestionIndex + 1} of {totalQuestions}</h2>
            <p className="muted small">{VIDEO_MAP[assignedType].name}</p>

            <div className="single-question">
              <div className="q-text-large">{qList[currentQuestionIndex]}</div>
              <div className="q-choices-vertical">
                {LIKERT.map((label, li) => (
                  <label key={li} className="choice-large">
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
            </div>

            <div style={{ marginTop: 20, marginBottom: 12 }}>
              <button className="btn link" onClick={handleMoreInfoClick}>More information about the product</button>
              {assignedAd && <a className="more-link" href={assignedAd.moreInfo} target="_blank" rel="noreferrer" style={{ marginLeft: 12 }}>{assignedAd.moreInfo}</a>}
            </div>

            <div className="card-actions">
              {currentQuestionIndex > 0 && (
                <button className="btn ghost" onClick={handlePreviousQuestion}>Previous</button>
              )}
              {!isLastQuestion ? (
                <button className="btn primary" onClick={handleNextQuestion}>Next</button>
              ) : (
                <button className="btn primary" onClick={handleSubmit}>Submit</button>
              )}
            </div>
          </div>
        )}

        {stage === "complete" && (
          <div className="card centered">
            <h2>Thank you!</h2>
            <p>Your responses have been recorded.</p>
            {completionCode && <div className="completion"><strong>Completion code:</strong> <code>{completionCode}</code><p className="muted small">Copy this code to claim credit (if required).</p></div>}
          </div>
        )}

        <footer className="footer">
          <small>IIIT Hyderabad — Ad Response Study</small>
        </footer>
      </div>

      <style jsx>{`
        :root{--bg:#f6f8fb;--card:#fff;--muted:#6b7280;--primary:#0f62fe;--accent:#7c3aed;}
        .page{min-height:100vh;background:linear-gradient(180deg,#f7fbff 0%,var(--bg)100%);padding:28px;}
        .container{max-width:980px;margin:0 auto;font-family:Inter,system-ui,Arial;color:#111827}
        .header{text-align:center;margin-bottom:10px}
        .header h1{margin:0;font-size:28px}
        .sub{color:var(--muted);margin-top:6px}
        .card{background:var(--card);border-radius:12px;box-shadow:0 8px 30px rgba(15,23,42,0.06);padding:20px;margin:18px 0;border:1px solid rgba(15,23,42,0.03)}
        .card.centered{text-align:center}
        .consent-actions{display:flex;flex-direction:column;gap:12px;margin-top:12px}
        .card-actions{margin-top:18px;display:flex;gap:12px;align-items:center}
        .btn{padding:10px 14px;border-radius:8px;border:none;cursor:pointer;font-weight:600;background:transparent;font-size:14px}
        .btn.primary{background:linear-gradient(90deg,var(--primary),#0056e6);color:white;box-shadow:0 6px 18px rgba(15,98,254,0.12)}
        .btn.ghost{border:1px solid rgba(15,23,42,0.08);background:transparent;color:#111827}
        .btn.link{text-decoration:underline;background:transparent;color:var(--accent);font-weight:600;padding:6px 8px}
        .btn:disabled{opacity:0.5;cursor:not-allowed}
        .muted{color:var(--muted)}
        .small{font-size:13px}
        .radio,.radio-inline{display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500}
        .radio-inline{display:inline-flex;margin-right:16px}
        .form-row{margin:16px 0}
        .form-row label:first-child{display:block;font-weight:600;margin-bottom:8px}
        .single-question{padding:24px;background:linear-gradient(180deg,#fff,#fbfdff);border-radius:12px;border:1px solid rgba(2,6,23,0.04)}
        .q-text-large{font-size:18px;font-weight:600;margin-bottom:24px;line-height:1.5;color:#111827}
        .q-choices-vertical{display:flex;flex-direction:column;gap:12px}
        .choice-large{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:8px;border:2px solid rgba(15,23,42,0.08);cursor:pointer;transition:all 0.2s ease;background:#fff}
        .choice-large:hover{border-color:var(--primary);background:#f8faff}
        .choice-large input:checked ~ span{font-weight:600;color:var(--primary)}
        .choice-large input{transform:scale(1.2);cursor:pointer}
        .choice-large span{font-size:15px;color:#374151;font-weight:500}
        .more-link{margin-left:10px;color:var(--muted);font-size:13px;text-decoration:underline}
        footer.footer{text-align:center;color:var(--muted);margin-top:14px}
        .completion{margin-top:12px;padding:12px;background:#f3f6ff;border-radius:8px;border:1px solid rgba(15,98,254,0.06);text-align:center}
        .completion code{background:#fff;padding:4px 8px;border-radius:6px;font-family:monospace}
        .progress{height:8px;background:rgba(2,6,23,0.05);border-radius:999px;margin:8px 0 16px;overflow:hidden}
        .progress-inner{height:100%;background:linear-gradient(90deg,var(--primary),var(--accent));width:0%;transition:width .6s ease}
        @media (max-width:720px){.container{padding:0 12px}.choice-large{padding:12px}}
      `}</style>
    </div>
  );
}

function ProgressBar({ stage = "consent", currentQ = 0, totalQ = 1 }) {
  let pct = 0;
  if (stage === "consent") pct = 10;
  if (stage === "demographics") pct = 30;
  if (stage === "video") pct = 60;
  if (stage === "questions") {
    const questionProgress = totalQ > 0 ? (currentQ / totalQ) * 20 : 0;
    pct = 80 + questionProgress;
  }
  if (stage === "complete") pct = 100;
  return (
    <div className="progress" aria-hidden>
      <div className="progress-inner" style={{ width: `${pct}%` }} />
    </div>
  );
}