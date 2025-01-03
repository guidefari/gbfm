type Props = {
	tracks: string[];
};

const Tracklist = ({ tracks }: Props) => (
	<ol>
		{tracks.map((track) => (
			<li key={track}>
				<a
					target="_blank"
					href={`https://www.google.com/search?q=${encodeURIComponent(track)}`}
					rel="noreferrer"
				>
					{track}
				</a>
			</li>
		))}
	</ol>
);

export default Tracklist;
