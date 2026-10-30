/**
 * Medrynx Time-Based Greeting Utility
 * Dynamically computes appropriate greeting based on client's local hour.
 */

export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  }
  if (hour >= 17 && hour < 21) {
    return 'Good evening';
  }
  return 'Good night';
}

export function getGreetingWithEmoji(): { greeting: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { greeting: 'Good morning', emoji: '🌅' };
  }
  if (hour >= 12 && hour < 17) {
    return { greeting: 'Good afternoon', emoji: '☀️' };
  }
  if (hour >= 17 && hour < 21) {
    return { greeting: 'Good evening', emoji: '🌆' };
  }
  return { greeting: 'Good night', emoji: '🌙' };
}
