import dayjs, { type ConfigType } from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

export { dayjs };

export const formatDate = (date: ConfigType, template = "YYYY-MM-DD") =>
	dayjs(date).format(template);

export const formatDuration = (to: dayjs.ConfigType, base?: dayjs.ConfigType, plain = false) => {
	const reference = dayjs(base);
	const totalMinutes = Math.abs(reference.diff(to, "minutes"));
	if (totalMinutes < 1) return plain ? "instant" : "just now";

	const days = Math.floor(totalMinutes / (60 * 24));
	const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
	const minutes = totalMinutes % 60;

	const parts: string[] = [];
	if (days) parts.push(`${days}d`);
	if (hours) parts.push(`${hours}h`);
	if (minutes) parts.push(`${minutes}m`);

	const duration = parts.join(" ");
	return plain ? duration : reference.isBefore(to) ? `in ${duration}` : `${duration} ago`;
};
