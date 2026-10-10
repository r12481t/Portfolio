// Add-on picker for the custom builds page.
// When a visitor chooses an add-on from the dropdown, this fills the box
// underneath with its price, the extra time it needs, and what it includes.
// The facts live in data-* attributes on each <option> in builds.html, so to
// change a price or a description you edit the HTML and never this file.
// If JavaScript is off, builds.html shows the same list as a plain table instead.

(function () {
  var select = document.getElementById('addon-select');
  var panel = document.getElementById('addon-panel');
  var link = document.getElementById('addon-link');
  var picker = document.getElementById('picker');

  // Stop quietly if the page does not have the pieces (for example, a copy of
  // the page where the add-on section was removed).
  if (!select || !panel || !link || !picker) { return; }

  // The picker starts hidden in the HTML. It only appears when JavaScript is
  // working, because without JavaScript it could not do anything.
  picker.hidden = false;

  // The email address is typed once, in the HTML link. We keep its base part
  // (everything before the "?") and add a subject line that names the add-on.
  var mailBase = link.getAttribute('href').split('?')[0];

  // Small helper: make an element with some text. textContent is used on
  // purpose, because it can never run code that was pasted into the page.
  function makeLine(tag, className, text) {
    var el = document.createElement(tag);
    el.className = className;
    el.textContent = text;
    return el;
  }

  function showAddon() {
    var option = select.options[select.selectedIndex];

    // Nothing chosen yet: show the hint again.
    if (!option.value) {
      panel.replaceChildren(makeLine('p', 'addon-hint', 'Pick an add-on to see the price, the extra time and what it includes.'));
      return;
    }

    var subject = 'Website quote: ' + option.text;
    link.setAttribute('href', mailBase + '?subject=' + encodeURIComponent(subject));
    link.textContent = 'Ask about this add-on';

    panel.replaceChildren(
      makeLine('p', 'addon-title', option.text),
      makeLine('p', 'addon-facts', option.getAttribute('data-price') + ', ' + option.getAttribute('data-time')),
      makeLine('p', 'addon-text', option.getAttribute('data-text')),
      link
    );
  }

  select.addEventListener('change', showAddon);

  // Show the starting hint when the page loads.
  showAddon();
})();
