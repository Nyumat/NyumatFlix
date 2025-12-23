/**
 * Formats a time difference into a readable countdown string
 * @param targetDate - The target date to count down to
 * @returns Formatted countdown string (e.g., "3 days, 5 hours" or "2 hours, 30 minutes")
 */
export function formatCountdown(targetDate: Date): string {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return "Available now";
  }

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Less than 1 hour: show minutes
  if (totalHours < 1) {
    return `${totalMinutes} ${totalMinutes === 1 ? "minute" : "minutes"}`;
  }

  // Less than 24 hours: show hours and minutes
  if (totalDays < 1) {
    const hours = totalHours;
    const minutes = totalMinutes % 60;
    if (minutes === 0) {
      return `${hours} ${hours === 1 ? "hour" : "hours"}`;
    }
    return `${hours} ${hours === 1 ? "hour" : "hours"}, ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }

  // 24 hours or more: show days and hours
  const days = totalDays;
  const hours = totalHours % 24;
  if (hours === 0) {
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  return `${days} ${days === 1 ? "day" : "days"}, ${hours} ${hours === 1 ? "hour" : "hours"}`;
}
