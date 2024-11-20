import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	return (
		<>
			<section>
				<h1>Let me show you around.</h1>
				<p>There's a few different kinds of on this site:</p>
				<ul>
					<li>
						<Link to="/words">Long form writing</Link>
					</li>
					<li>
						<Link to="/micro">Micro blog posts. Kinda like tweets</Link>
					</li>
					<li>
						<Link to="/labels">Record labels worth checking out</Link>
					</li>
					<li>
						<Link to="/mixes">An archive of DJ Mixes</Link>
					</li>
					<li>
						{/* @ts-expect-error - occasionally experiment with removing this👀 */}
						<Link to="/read/words/how-to">
							Demo of the music preview feature
						</Link>
					</li>
				</ul>
			</section>
			<section>
				<h1>Housekeeping</h1>
				<ul>
					<li>
						You can find the source code for this site on{" "}
						<a href="https://github.com/guidefari/gbfm">GitHub</a>.
					</li>
					<li>
						I recently went through an infra migration. I write about it{" "}
						<a href="http://guidefari.com/gbfm-sst">here</a>
					</li>
				</ul>
			</section>
		</>
	);
}
