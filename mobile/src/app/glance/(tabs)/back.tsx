import { Redirect } from 'expo-router';
/** The tab that leaves Glance for the rest of the app. */
export default function BackToQueueUp() { return <Redirect href="/events" />; }
