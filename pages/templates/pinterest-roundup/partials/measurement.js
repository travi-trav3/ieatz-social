'use strict';
// Attribution + measurement, carried over from the v0.3 example. Same event
// names and CTA positions: app_store_click {cta_position, platform},
// scroll_depth {depth}, item_anchor_click {item_name}. UTM params on the URL
// ride along on every event and go to GA4 only. Apple ignores UTMs; the
// store links carry pt/ct/mt instead.
function render(page) {
  const firstAnchor = page.recipes[0] ? page.recipes[0].anchor : '';
  const slug = JSON.stringify(page.slug);
  const first = JSON.stringify(firstAnchor);
  return `<script>
var UTM = (function(){var p=new URLSearchParams(location.search),o={};["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(k){if(p.get(k))o[k]=p.get(k)});return o})();
function track(event, params){var payload=Object.assign({event:event,page_slug:${slug}},UTM,params||{});(window.dataLayer=window.dataLayer||[]).push(payload);if(typeof window.gtag==="function")window.gtag("event",event,payload)}
(function(){
  var seen={}, bar=document.getElementById("sticky-cta");
  var first=document.getElementById(${first})||document.querySelector("main article[id]");
  function onScroll(){
    var max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
    var pct=(window.scrollY/max)*100;
    [25,50,75,100].forEach(function(d){if(pct>=d&&!seen[d]){seen[d]=1;track("scroll_depth",{depth:d})}});
    var past=first?window.scrollY>first.offsetTop+first.offsetHeight*0.6:window.scrollY>1600;
    if(bar)bar.style.display=past?"flex":"none";
  }
  window.addEventListener("scroll",onScroll,{passive:true});onScroll();
  document.querySelectorAll("[data-anchor-name]").forEach(function(a){
    a.addEventListener("click",function(){track("item_anchor_click",{item_name:a.getAttribute("data-anchor-name")})});
  });
})();
</script>`;
}

module.exports = { render };
