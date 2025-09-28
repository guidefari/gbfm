// import { format, parseISO } from "date-fns";

// export const LilDate = ({ date }: { date: string }) => {
// 	return (
// 		<time dateTime={date} className="text-xs opacity-80 bg-gb-bg">
// 			{format(parseISO(date), "LLLL d, yyyy")}
// 		</time>
// 	);
// };

export const LilDate = ({ date }: { date: string | Date }) => {
  const parsedDate = new Date(date)
  const formattedDate = parsedDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <time dateTime={date.toString()} className='text-xs opacity-80 bg-gb-bg'>
      {formattedDate}
    </time>
  )
}
