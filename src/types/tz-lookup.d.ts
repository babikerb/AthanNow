declare module 'tz-lookup' {
  /** Returns the IANA timezone name for a coordinate, e.g. "America/Los_Angeles". */
  export default function tzlookup(latitude: number, longitude: number): string;
}
