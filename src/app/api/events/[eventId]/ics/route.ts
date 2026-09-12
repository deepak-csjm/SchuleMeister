import { NextResponse } from 'next/server';
import { buildIcsCalendar, icsFileName } from '@/lib/ics';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Serves a single public event as an RFC 5545 calendar file.
 * Unpublished events are treated as non-existent.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, isPublished: true },
    include: { school: { select: { id: true, name: true, address: true, postalCode: true, city: true } } },
  });

  if (!event) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const schoolAddress = `${event.school.address}, ${event.school.postalCode} ${event.school.city}`;

  const calendar = buildIcsCalendar({
    id: event.id,
    title: `${event.title} – ${event.school.name}`,
    description: [
      event.description,
      event.targetGrade ? `Zielgruppe: ${event.targetGrade}` : null,
      `${origin}/schools/${event.school.id}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    eventDate: event.eventDate,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location ? `${event.location}, ${schoolAddress}` : schoolAddress,
    url: `${origin}/schools/${event.school.id}`,
    uidDomain: new URL(request.url).host,
  });

  return new NextResponse(calendar, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${icsFileName(event.title, event.eventDate)}"`,
      'Cache-Control': 'public, max-age=0, s-maxage=300',
    },
  });
}
