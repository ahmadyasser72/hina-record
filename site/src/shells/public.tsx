import type { ShellProps } from "@pracht/core";

import "../styles/global.css";

export function Shell({ children }: ShellProps) {
	return (
		<div
			style={{
				fontFamily: "Inter, system-ui, sans-serif",
				margin: "0 auto",
				maxWidth: "720px",
				padding: "48px 20px",
			}}
		>
			<header style={{ marginBottom: "32px" }}>
				<strong>site</strong>
				<p style={{ color: "#555", margin: "8px 0 0" }}>A new pracht app.</p>
			</header>
			<main>{children}</main>
		</div>
	);
}

export function head() {
	return {
		lang: "en",
		meta: [
			{ content: "width=device-width, initial-scale=1", name: "viewport" },
		],
		title: "site",
	};
}
