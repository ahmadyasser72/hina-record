import "htmx.org";

import "htmx.org/dist/ext/hx-browser-indicator";
import "htmx.org/dist/ext/hx-live";

// @ts-expect-error helper
window.__elementIsInViewport = (element: HTMLElement) => {
	const bounding = element.getBoundingClientRect();
	return (
		bounding.top >= 0 &&
		bounding.left >= 0 &&
		bounding.right <=
			(window.innerWidth || document.documentElement.clientWidth) &&
		bounding.bottom <=
			(window.innerHeight || document.documentElement.clientHeight)
	);
};
