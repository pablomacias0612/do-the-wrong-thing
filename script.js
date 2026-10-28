'use strict';

// Each choice declares whether it disobeys the instruction, including the negatives.
const rounds = [
  { instruction:'CLICK RED', choices:[['RED','red',false],['BLUE','blue',true]] },
  { instruction:'CLICK THE BUTTON ON THE LEFT', choices:[['LEFT','blue',false],['RIGHT','yellow',true]] },
  { instruction:'CLICK THE BIGGER CIRCLE', choices:[['','red circle big',false,'Bigger circle'],['','blue circle small',true,'Smaller circle']] },
  { instruction:'CLICK 8', choices:[['8','yellow',false],['3','blue',true]] },
  { instruction:'CLICK YES', choices:[['YES','green',false],['NO','red',true]] },
  { instruction:"DON'T CLICK BLUE", choices:[['RED','red',false],['BLUE','blue',true]] },
  { instruction:"DON'T CLICK THE BUTTON ON THE LEFT", choices:[['LEFT','yellow',true],['RIGHT','blue',false]] },
  { instruction:'DO NOT PICK 4', choices:[['7','blue',false],['4','red',true]] },
  { instruction:'CLICK THE LARGER NUMBER', choices:[['2','green',true],['9','yellow',false]] },
  { instruction:"DON'T CHOOSE THE SMALL CIRCLE", choices:[['','blue circle small',true,'Small circle'],['','red circle big',false,'Big circle']] },
  { instruction:'CLICK THE WORD RED', hint:'READ THE WORD, NOT ITS COLOR.', choices:[['RED','word blue-text',false],['BLUE','word red-text',true]] },
  { instruction:'CLICK THE RED WORD', hint:'THE COLOR OF THE TEXT MATTERS.', choices:[['RED','word blue-text',true],['BLUE','word red-text',false]] },
  { instruction:"DON'T CLICK THE WORD GREEN", hint:'READ THE WORD, NOT ITS COLOR.', choices:[['GREEN','word red-text',true],['RED','word green-text',false]] },
  { instruction:'CLICK THE BLUE WORD', hint:'THE COLOR OF THE TEXT MATTERS.', choices:[['BLUE','word green-text',true],['GREEN','word blue-text',false]] },
  { instruction:'CLICK THE CIRCLE SHAPE', hint:'LOOK AT THE SHAPE, NOT THE LABEL.', choices:[['CIRCLE','yellow',true],['SQUARE','blue circle medium',false]] },
  { instruction:'CLICK THE WORD LEFT', hint:'THE LABEL, NOT THE POSITION.', choices:[['RIGHT','blue',true],['LEFT','red',false]] },
  { instruction:'CLICK THE BUTTON ON THE LEFT', hint:'THE POSITION, NOT THE LABEL.', choices:[['RIGHT','red',false],['LEFT','blue',true]] },
  { instruction:'CLICK THE BOTTOM BUTTON', hint:'POSITION MATTERS.', layout:'vertical', choices:[['BOTTOM','yellow',true],['TOP','blue',false]] },
  { instruction:'CLICK THE BUTTON LABELED WRONG', choices:[['WRONG','red',false],['RIGHT','green',true]] },
  { instruction:'DO NOT CLICK THE BUTTON LABELED THIS', choices:[['THIS','yellow',true],['THAT','blue',false]] },
  { instruction:'IGNORE THE BUTTON LABELED YES', choices:[['NO','red',false],['YES','green',true]] },
  { instruction:"DON'T CLICK NOW", cue:'WAIT FOR THE INSTRUCTION…', cueTime:650, hint:'DO THE OPPOSITE. QUICKLY.', choices:[['CLICK','blue',true],['CLICK','yellow',true]] },
  { instruction:"DON'T CLICK RED", cue:'CLICK RED', cueTime:450, hint:'THE FINAL INSTRUCTION COUNTS.', choices:[['RED','red',true],['BLUE','blue',false]] },
  { instruction:'DO THE WRONG THING.', choices:[['WIN','green final',false],['LOSE','red final',true]] }
];
const successPhrases = ['GOOD. THAT WAS WRONG.','NICE DISOBEDIENCE.','INCORRECT. PERFECT.','BAD CHOICE. GOOD JOB.','YOU BROKE THE RULE. BEAUTIFUL.'];
const milestones = {5:'GETTING COCKY?',10:"YOU'RE LEARNING.",15:'STOP THINKING.'};
function roundTime(index, currentStreak) {
  const base = index < 4 ? 2.7 : index < 8 ? 2.4 : index < 12 ? 2.1 : index < 16 ? 1.8 : index < 20 ? 1.6 : 1.4;
  return Math.max(1.2, base - (currentStreak >= 5 ? .1 : 0));
}
function streakMultiplier(value) {
  return value >= 10 ? 2 : value >= 5 ? 1.5 : value >= 3 ? 1.2 : 1;
}

const $ = id => document.getElementById(id);
const screens = ['title','intro','game','finale','end'];
let roundIndex = 0, score = 0, streak = 0, bestStreak = 0, deadline = 0, frame = 0, active = false, soundOn = true, audioContext, dodgeCount = 0, pending = [], roundToken = 0, timeLimit = 0, phraseIndex = -1;

function showScreen(name) {
  screens.forEach(screen => $(screen + '-screen').classList.toggle('active', screen === name));
}
function later(fn, ms) { const id = setTimeout(fn, ms); pending.push(id); return id; }
function clearPending() { pending.forEach(clearTimeout); pending = []; cancelAnimationFrame(frame); }
function tone(frequency, duration = .12, delay = 0, type = 'sine') {
  if (!soundOn) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    const start = audioContext.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(.09, start + .015); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + duration + .01);
  } catch (_) { /* Sound is optional; gameplay never depends on it. */ }
}
function playVictory() { [440,554,659,880].forEach((freq, i) => tone(freq,.22,i*.11)); }
function resetGame() {
  clearPending(); active = false; roundToken++; roundIndex = score = streak = bestStreak = 0; dodgeCount = 0; phraseIndex = -1; document.body.classList.remove('high-streak', 'time-pressure');
  $('rules-button').style.transform = ''; $('confetti').replaceChildren(); $('feedback').className = 'feedback';
  updateStats(); showScreen('intro'); tone(440,.12); later(startRound, 1750);
}
function updateStats() {
  $('score').textContent = score.toLocaleString('en-US');
  $('streak').innerHTML = `x${streak} <i>✦</i>`;
  document.body.classList.toggle('high-streak', streak >= 10);
}
function startRound() {
  const round = rounds[roundIndex];
  const currentToken = ++roundToken;
  active = false; timeLimit = roundTime(roundIndex, streak);
  document.body.classList.remove('time-pressure');
  showScreen('game'); $('feedback').className = 'feedback';
  $('round-number').textContent = String(roundIndex + 1).padStart(2,'0');
  $('progress-label').textContent = `${String(roundIndex + 1).padStart(2,'0')} / ${rounds.length}`;
  $('instruction').textContent = round.cue || round.instruction;
  $('challenge-hint').textContent = round.cue ? (roundIndex === 22 ? 'WAIT FOR THE FINAL INSTRUCTION.' : 'GET READY.') : (round.hint || 'REMEMBER: DISOBEY.');
  $('choices').replaceChildren(); $('choices').classList.toggle('vertical', round.layout === 'vertical');
  round.choices.forEach(([label, className, correct, aria]) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = `choice ${className}`; button.textContent = label;
    if (aria) button.setAttribute('aria-label', aria);
    button.disabled = !!round.cue;
    button.addEventListener('click', () => answer(correct, false, currentToken)); $('choices').append(button);
  });
  $('timer-fill').style.transform = 'scaleX(1)'; $('time-text').textContent = timeLimit.toFixed(1); document.querySelector('.timer-row').classList.remove('low');
  const activate = () => {
    if (currentToken !== roundToken) return;
    $('instruction').textContent = round.instruction;
    $('challenge-hint').textContent = round.hint || 'REMEMBER: DISOBEY.';
    $('choices').children && Array.from($('choices').children).forEach(button => { button.disabled = false; });
    active = true; deadline = performance.now() + timeLimit * 1000; frame = requestAnimationFrame(tick);
  };
  if (round.cue) later(activate, round.cueTime); else activate();
}

function tick(now) {
  if (!active) return;
  const remaining = Math.max(0, deadline - now);
  $('timer-fill').style.transform = `scaleX(${remaining / (timeLimit * 1000)})`;
  $('time-text').textContent = (Math.ceil(remaining / 100) / 10).toFixed(1);
  document.querySelector('.timer-row').classList.toggle('low', remaining <= timeLimit * 350);
  document.body.classList.toggle('time-pressure', remaining > 0 && remaining <= timeLimit * 350);
  if (remaining <= 0) answer(false, true); else frame = requestAnimationFrame(tick);
}
function answer(correct, timedOut = false, token = roundToken) {
  if (!active || token !== roundToken) return;
  // Check the clock again on click so a late event can't beat a delayed animation frame.
  if (performance.now() >= deadline) { correct = false; timedOut = true; }
  active = false; cancelAnimationFrame(frame); document.body.classList.remove('time-pressure');
  if (timedOut) { $('timer-fill').style.transform = 'scaleX(0)'; $('time-text').textContent = '0.0'; }
  document.querySelectorAll('.choice').forEach(button => { button.disabled = true; });
  if (correct) {
    streak++; bestStreak = Math.max(bestStreak, streak);
    const bonus = Math.round(50 * Math.max(0, deadline - performance.now()) / (timeLimit * 1000));
    const points = Math.round((100 + bonus) * streakMultiplier(streak));
    score += points; updateStats(); $('score').classList.remove('score-pop'); void $('score').offsetWidth; $('score').classList.add('score-pop');
    if (roundIndex === rounds.length - 1) { victory(); return; }
    tone(660,.12); tone(880,.13,.09);
    phraseIndex = (phraseIndex + 1 + Math.floor(Math.random() * (successPhrases.length - 1))) % successPhrases.length;
    feedback(true, successPhrases[phraseIndex], milestones[streak] ? `${milestones[streak]}  ·  +${points}` : `+${points} POINTS`);
  } else {
    streak = 0; updateStats(); tone(150,.25,0,'triangle');
    feedback(false, timedOut ? 'TOO SLOW.' : 'TOO OBEDIENT.', timedOut ? 'DOING NOTHING IS STILL A CHOICE.' : 'YOU FOLLOWED THE RULES.');
  }
  // The finale must be solved to finish; earlier mistakes still advance the experiment.
  later(() => { if (roundIndex < rounds.length - 1) roundIndex++; startRound(); }, correct ? 360 : 700);
}
function feedback(success, title, sub) {
  $('feedback-icon').textContent = success ? '✓' : '×'; $('feedback-title').textContent = title; $('feedback-sub').textContent = sub;
  $('feedback').className = `feedback show ${success ? 'success' : 'failure'}`;
}
function victory() {
  showScreen('finale'); $('finale-copy').className = 'finale-copy'; $('finale-copy').innerHTML = 'YOU LOSE<span>.</span>'; tone(180,.25,0,'triangle');
  later(() => { $('finale-copy').className = 'finale-copy win'; $('finale-copy').textContent = '...WHICH MEANS YOU WIN.'; playVictory(); confetti(); }, 1500);
  later(() => { $('final-score').textContent = score.toLocaleString('en-US'); $('best-streak').textContent = bestStreak; showScreen('end'); }, 3600);
}
function confetti() {
  const container = $('confetti'); container.replaceChildren();
  const colors = ['#d9fd54','#ff625e','#6394ff','#67dba8','#ffdb68'];
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement('i'); piece.style.setProperty('--left', `${Math.random()*100}%`); piece.style.setProperty('--delay', `${Math.random()*.7}s`); piece.style.setProperty('--duration', `${2.5+Math.random()*2}s`); piece.style.setProperty('--drift', `${Math.random()*160-80}px`); piece.style.setProperty('--color', colors[i%colors.length]); container.append(piece);
  }
  later(() => container.replaceChildren(), 5500);
}
$('start-button').addEventListener('click', resetGame);
$('play-again').addEventListener('click', resetGame);
$('sound-toggle').addEventListener('click', () => { soundOn = !soundOn; $('sound-toggle').setAttribute('aria-pressed', String(!soundOn)); $('sound-toggle').setAttribute('aria-label', soundOn ? 'Mute sound' : 'Enable sound'); $('sound-label').textContent = soundOn ? 'SOUND ON' : 'SOUND OFF'; $('sound-icon').textContent = soundOn ? '♪' : '×'; if (soundOn) tone(660); });
// Pointer users get two playful dodges; touch and keyboard can always activate it.
$('rules-button').addEventListener('pointerenter', event => { if (event.pointerType !== 'mouse' || dodgeCount >= 2) return; dodgeCount++; $('rules-button').style.transform = `translate(${dodgeCount === 1 ? 35 : -25}px, ${dodgeCount === 1 ? -12 : 8}px)`; });
$('rules-button').addEventListener('click', () => { clearPending(); active = false; roundToken++; $('rules-button').style.transform = ''; showScreen('title'); });
