// moon_title.ts

const titleTag = document.getElementsByTagName('title')[0];

const moons = "🌑🌒🌓🌔🌕🌖🌗🌘";
const emojiSegmenter = new Intl.Segmenter("en", {granularity: "grapheme"});
const moonPhases = [...emojiSegmenter.segment(moons)].map((s) => s.segment);

var phase = 0;
setInterval(function() {
   titleTag.innerHTML = "Oh, hello " + moonPhases[phase];
   phase = (phase + 1) % moonPhases.length;
}, 250);
