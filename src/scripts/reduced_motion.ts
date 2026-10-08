// reduced_motion.ts

// A stopped <marquee> sits offscreen, so swap it for still text instead.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function stillMarquee() {
   if (!reduceMotion.matches) return;
   for (const marquee of document.querySelectorAll('marquee')) {
      const still = document.createElement('p');
      for (const attr of marquee.attributes) still.setAttribute(attr.name, attr.value);
      still.textContent = marquee.textContent;
      marquee.replaceWith(still);
   }
}

stillMarquee();
reduceMotion.addEventListener('change', stillMarquee);
