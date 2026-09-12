import { APP_TIME_ZONE, parseTimeString, zonedDateParts, zonedTimeToUtc } from './datetime';

/**
 * Schema.org JSON-LD for a school and its published dates.
 *
 * Rendered on the public school page so that search engines can surface the
 * address, contact details and - importantly for parents - the open house dates
 * as events. Built as a plain object and serialised with JSON.stringify, so
 * school-supplied text cannot break out of the script element.
 */

export interface StructuredDataSchool {
  id: string;
  officialCode: string;
  name: string;
  type: string;
  address: string;
  postalCode: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
}

export interface StructuredDataEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: Date;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
}

/** Maps our school types onto the closest Schema.org type. */
function schemaType(type: string): string {
  switch (type) {
    case 'GRUNDSCHULE':
      return 'ElementarySchool';
    case 'HAUPTSCHULE':
    case 'REALSCHULE':
    case 'GESAMTSCHULE':
    case 'GYMNASIUM':
      return 'HighSchool';
    default:
      // FOERDERSCHULE and BERUFSKOLLEG have no closer equivalent.
      return 'School';
  }
}

/** ISO 8601 with offset, which is what Schema.org expects for event times. */
function isoWithOffset(date: Date, time: string | null): string {
  const day = zonedDateParts(date, APP_TIME_ZONE);
  const parsed = time ? parseTimeString(time) : null;

  if (!parsed) {
    // Date-only value for all-day entries such as registration windows.
    return `${String(day.year).padStart(4, '0')}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
  }

  return zonedTimeToUtc({ ...day, hours: parsed.hours, minutes: parsed.minutes }).toISOString();
}

export function buildSchoolJsonLd(
  school: StructuredDataSchool,
  events: StructuredDataEvent[],
  pageUrl: string,
): Record<string, unknown> {
  const postalAddress = {
    '@type': 'PostalAddress',
    streetAddress: school.address,
    postalCode: school.postalCode,
    addressLocality: school.city,
    addressRegion: 'Nordrhein-Westfalen',
    addressCountry: 'DE',
  };

  const schoolNode: Record<string, unknown> = {
    '@type': schemaType(school.type),
    '@id': pageUrl,
    name: school.name,
    url: pageUrl,
    address: postalAddress,
    identifier: {
      '@type': 'PropertyValue',
      name: 'Schulnummer NRW',
      value: school.officialCode,
    },
  };

  if (school.description) schoolNode.description = school.description;
  if (school.phone) schoolNode.telephone = school.phone;
  if (school.email) schoolNode.email = school.email;
  if (school.website) schoolNode.sameAs = school.website;
  if (school.latitude !== null && school.longitude !== null) {
    schoolNode.geo = {
      '@type': 'GeoCoordinates',
      latitude: school.latitude,
      longitude: school.longitude,
    };
  }

  const eventNodes = events.map((event) => {
    const node: Record<string, unknown> = {
      '@type': 'Event',
      name: event.title,
      startDate: isoWithOffset(event.eventDate, event.startTime),
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      organizer: { '@type': schemaType(school.type), name: school.name, url: pageUrl },
      location: {
        '@type': 'Place',
        name: event.location ? `${school.name} - ${event.location}` : school.name,
        address: postalAddress,
      },
      // The dates are free to attend; saying so explicitly avoids Google
      // treating them as paid events with missing price information.
      isAccessibleForFree: true,
    };

    if (event.endTime) node.endDate = isoWithOffset(event.eventDate, event.endTime);
    if (event.description) node.description = event.description;
    return node;
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [schoolNode, ...eventNodes],
  };
}
