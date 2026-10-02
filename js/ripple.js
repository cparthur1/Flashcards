/**
 * Material 3 Expressive Delegated Ripple Effect
 * Provides smooth, touch- and click-originating Material Design 3 ripples
 * across all interactive buttons and surfaces in the app without distorting layouts.
 */
(function() {
  'use strict';

  function createRipple(e) {
    // Only primary mouse click (button === 0) or touch/pen
    if (e.button !== undefined && e.button !== 0) return;

    // Find the closest interactive button or surface
    const target = e.target.closest('button, .m3-btn-expressive, .tab-btn, .action-btn, [role="button"], .ripple-surface');
    if (!target) return;

    // Skip disabled elements or elements marked with .no-ripple
    if (target.disabled || target.classList.contains('no-ripple') || target.getAttribute('aria-disabled') === 'true') {
      return;
    }

    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : rect.left + rect.width / 2);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : rect.top + rect.height / 2);

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Calculate distance to furthest corner to guarantee full coverage of button
    const dx = Math.max(x, rect.width - x);
    const dy = Math.max(y, rect.height - y);
    const radius = Math.hypot(dx, dy);

    // Ensure target has a positioning context for the host
    if (window.getComputedStyle(target).position === 'static') {
      target.style.position = 'relative';
    }

    // Get or create isolated clipping host container to prevent affecting parent button layout/dimensions
    let host = target.querySelector(':scope > .m3-ripple-host');
    if (!host) {
      host = document.createElement('span');
      host.className = 'm3-ripple-host';
      target.appendChild(host);
    }

    const ripple = document.createElement('span');
    ripple.className = 'm3-ripple-wave';
    ripple.style.width = `${radius * 2}px`;
    ripple.style.height = `${radius * 2}px`;
    ripple.style.left = `${x - radius}px`;
    ripple.style.top = `${y - radius}px`;

    // Support custom ripple color via data-ripple-color or --md-ripple-color
    const customColor = target.getAttribute('data-ripple-color') || window.getComputedStyle(target).getPropertyValue('--md-ripple-color').trim();
    if (customColor) {
      ripple.style.backgroundColor = customColor;
    }

    host.appendChild(ripple);

    let isRemoved = false;
    function endRipple() {
      if (isRemoved) return;
      isRemoved = true;
      ripple.classList.add('fade-out');
      setTimeout(() => {
        if (ripple.parentNode) {
          ripple.parentNode.removeChild(ripple);
        }
        if (host && host.children.length === 0 && host.parentNode) {
          host.parentNode.removeChild(host);
        }
      }, 300);

      window.removeEventListener('pointerup', endRipple);
      window.removeEventListener('pointercancel', endRipple);
      target.removeEventListener('pointerleave', endRipple);
    }

    window.addEventListener('pointerup', endRipple, { once: true });
    window.addEventListener('pointercancel', endRipple, { once: true });
    target.addEventListener('pointerleave', endRipple, { once: true });
  }

  // Attach to window with passive listener for highest scrolling performance
  window.addEventListener('pointerdown', createRipple, { passive: true });
})();
