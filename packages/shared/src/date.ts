import dayjs, { type ConfigType } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

export { dayjs };

export const GBP_TIME_ZONE = "America/Los_Angeles";
dayjs.tz.setDefault(GBP_TIME_ZONE);

export const formatDate = (date: ConfigType, template = "YYYY-MM-DD") =>
	dayjs.tz(date).format(template);
