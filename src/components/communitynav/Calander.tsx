"use client";
import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { apiClient } from "@/lib/api-client";
import { IEvent } from "@/models/Event";
import { useNotification } from "../Notification";
import { Card, CardContent } from "../ui/card";

// Event creation/editing modal component
function EventModal({
  isOpen,
  onClose,
  event,
  onSave,
  onDelete,
  isAdmin,
}: {
  isOpen: boolean;
  onClose: () => void;
  event: {
    id?: string;
    title: string;
    start: Date;
    end: Date;
    description: string;
    location: string;
    allDay: boolean;
  };
  onSave: (event: any) => void;
  onDelete: () => void;
  isAdmin: boolean;
}) {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [location, setLocation] = useState(event.location);
  const [startDate, setStartDate] = useState(
    event.start.toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState(
    event.start.toISOString().slice(11, 16)
  );
  const [endDate, setEndDate] = useState(event.end.toISOString().slice(0, 10));
  const [endTime, setEndTime] = useState(event.end.toISOString().slice(11, 16));
  const [allDay, setAllDay] = useState(event.allDay);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Create start and end dates from the form inputs
    const start = allDay
      ? new Date(startDate)
      : new Date(`${startDate}T${startTime}`);

    const end = allDay ? new Date(endDate) : new Date(`${endDate}T${endTime}`);

    onSave({
      id: event.id,
      title,
      description,
      location,
      start,
      end,
      allDay,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {event.id ? "Edit Event" : "Create Event"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="eventTitle"
            >
              Title
            </label>
            <input
              type="text"
              id="eventTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input input-bordered w-full"
              placeholder="Enter event title"
              required
              readOnly={!isAdmin}
            />
          </div>

          <div className="mb-4">
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="eventDescription"
            >
              Description
            </label>
            <textarea
              id="eventDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="textarea textarea-bordered w-full"
              placeholder="Enter event description"
              readOnly={!isAdmin}
            />
          </div>

          <div className="mb-4">
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="eventLocation"
            >
              Location
            </label>
            <input
              id="eventLocation"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="input input-bordered w-full"
              placeholder="Enter event location"
              readOnly={!isAdmin}
            />
          </div>

          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="checkbox mr-2"
                disabled={!isAdmin}
              />
              <span>All Day Event</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="startDate"
              >
                Start Date
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input input-bordered w-full"
                title="Event start date"
                required
                readOnly={!isAdmin}
              />
            </div>

            {!allDay && (
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  htmlFor="startTime"
                >
                  Start Time
                </label>
                <input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input input-bordered w-full"
                  title="Event start time"
                  required
                  readOnly={!isAdmin}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="endDate"
              >
                End Date
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input input-bordered w-full"
                title="Event end date"
                required
                readOnly={!isAdmin}
              />
            </div>

            {!allDay && (
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  htmlFor="endTime"
                >
                  End Time
                </label>
                <input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input input-bordered w-full"
                  title="Event end time"
                  required
                  readOnly={!isAdmin}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>

            {isAdmin && (
              <>
                {event.id && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="btn btn-error"
                  >
                    Delete
                  </button>
                )}
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function Calander() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = useSession();
  const [events, setEvents] = useState<any[]>([]);
  const [communityId, setCommunityId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSubAdmin, setIsSubAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>({
    title: "",
    start: new Date(),
    end: new Date(),
    description: "",
    location: "",
    allDay: false,
  });
  const [viewMode, setViewMode] = useState<
    "dayGridMonth" | "timeGridWeek" | "timeGridDay"
  >("dayGridMonth");
  // We'll use this to track the current date in the calendar
  const [_, setCurrentDate] = useState(new Date());
  const [showYearPicker, setShowYearPicker] = useState(false);
  const calendarRef = useRef<any>(null);
  const yearPickerRef = useRef<HTMLDivElement>(null);
  const { showNotification } = useNotification();

  // Handle click outside to close year picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        yearPickerRef.current &&
        !yearPickerRef.current.contains(event.target as Node)
      ) {
        setShowYearPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch community data and events
  useEffect(() => {
    const fetchCommunityAndEvents = async () => {
      try {
        // Fetch community data
        const response = await fetch(`/api/community/${slug}`);
        if (!response.ok) {
          throw new Error("Failed to fetch community data");
        }

        const communityData = await response.json();
        setCommunityId(communityData._id);

        // Check if user is admin or sub-admin
        const userId = session?.user?.id;
        setIsAdmin(communityData.admin === userId);
        setIsSubAdmin(communityData.subAdmins?.includes(userId) || false);

        // Fetch events for this community (only for current month initially)
        if (communityData._id) {
          // Calculate start and end of current month
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

          const eventsData = await apiClient.getEvents(
            communityData._id,
            startOfMonth.toISOString(),
            endOfMonth.toISOString()
          );

          // Format events for FullCalendar
          const formattedEvents = eventsData.map((event: IEvent) => ({
            id: event._id,
            title: event.title,
            start: event.start,
            end: event.end,
            allDay: event.allDay,
            description: event.description || "",
            location: event.location || "",
            color: event.color,
            extendedProps: {
              createdBy: event.createdBy,
            },
          }));

          setEvents(formattedEvents);
        }
      } catch (error) {
        showNotification(
          error instanceof Error
            ? error.message
            : "Failed to load calendar data",
          "error"
        );
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.id) {
      fetchCommunityAndEvents();
    }
  }, [slug, session?.user?.id, showNotification]);

  // Handle date click (for creating new events)
  const handleDateClick = (info: any) => {
    if (isAdmin || isSubAdmin) {
      const clickedDate = info.date;
      const endDate = new Date(clickedDate);
      endDate.setHours(clickedDate.getHours() + 1);

      setSelectedEvent({
        title: "",
        start: clickedDate,
        end: endDate,
        description: "",
        location: "",
        allDay: info.allDay,
      });

      setModalOpen(true);
    }
  };

  // Handle event click (for viewing/editing events)
  const handleEventClick = (info: any) => {
    const event = {
      id: info.event.id,
      title: info.event.title,
      start: info.event.start,
      end:
        info.event.end || new Date(info.event.start.getTime() + 60 * 60 * 1000),
      description: info.event.extendedProps.description || "",
      location: info.event.extendedProps.location || "",
      allDay: info.event.allDay,
    };

    setSelectedEvent(event);
    setModalOpen(true);
  };

  // Handle saving an event (create or update)
  const handleSaveEvent = async (eventData: any) => {
    try {
      if (eventData.id) {
        // Update existing event
        const updatedEvent = await apiClient.updateEvent(eventData.id, {
          title: eventData.title,
          description: eventData.description,
          location: eventData.location,
          start: eventData.start,
          end: eventData.end,
          allDay: eventData.allDay,
        });

        // Update the events state
        setEvents(
          events.map((event) =>
            event.id === eventData.id
              ? {
                  ...event,
                  title: updatedEvent.title,
                  start: updatedEvent.start,
                  end: updatedEvent.end,
                  allDay: updatedEvent.allDay,
                  description: updatedEvent.description,
                  location: updatedEvent.location,
                }
              : event
          )
        );

        showNotification("Event updated successfully", "success");
      } else {
        // Create new event
        const newEvent = await apiClient.createEvent({
          title: eventData.title,
          description: eventData.description,
          location: eventData.location,
          start: eventData.start,
          end: eventData.end,
          allDay: eventData.allDay,
          communityId: communityId as any, // Type cast to avoid ObjectId type error
          createdBy: session?.user?.id || "",
          createdAt: new Date(),
        });

        // Add the new event to the events state
        setEvents([
          ...events,
          {
            id: newEvent._id,
            title: newEvent.title,
            start: newEvent.start,
            end: newEvent.end,
            allDay: newEvent.allDay,
            description: newEvent.description,
            location: newEvent.location,
            extendedProps: {
              createdBy: newEvent.createdBy,
            },
          },
        ]);

        showNotification("Event created successfully", "success");
      }
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : "Failed to save event",
        "error"
      );
    }
  };

  // Handle deleting an event
  const handleDeleteEvent = async () => {
    if (!selectedEvent.id) return;

    try {
      await apiClient.deleteEvent(selectedEvent.id);

      // Remove the event from the events state
      setEvents(events.filter((event) => event.id !== selectedEvent.id));

      setModalOpen(false);
      showNotification("Event deleted successfully", "success");
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : "Failed to delete event",
        "error"
      );
    }
  };

  // Change calendar view
  const changeView = (
    viewName: "dayGridMonth" | "timeGridWeek" | "timeGridDay"
  ) => {
    setViewMode(viewName);
    if (calendarRef.current) {
      calendarRef.current.getApi().changeView(viewName);
    }
  };

  // Navigate to previous month/week/day
  const navigatePrev = () => {
    if (calendarRef.current) {
      calendarRef.current.getApi().prev();
    }
  };

  // Navigate to next month/week/day
  const navigateNext = () => {
    if (calendarRef.current) {
      calendarRef.current.getApi().next();
    }
  };

  // Navigate to today
  const navigateToday = () => {
    if (calendarRef.current) {
      calendarRef.current.getApi().today();
    }
  };

  // Navigate to a specific date
  const navigateToDate = (date: Date) => {
    if (calendarRef.current) {
      calendarRef.current.getApi().gotoDate(date);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col space-y-4 mb-6">
              {/* Title and Add Event Button */}
              <div className="flex flex-col md:flex-row justify-between items-center">
                <h1 className="text-2xl font-bold mb-4 md:mb-0">
                  Community Calendar
                </h1>

                {(isAdmin || isSubAdmin) && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setSelectedEvent({
                        title: "",
                        start: new Date(),
                        end: new Date(new Date().getTime() + 60 * 60 * 1000),
                        description: "",
                        location: "",
                        allDay: false,
                      });
                      setModalOpen(true);
                    }}
                  >
                    Add Event
                  </button>
                )}
              </div>

              {/* Navigation and View Controls */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                {/* Navigation Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={navigateToday}
                  >
                    Today
                  </button>

                  <div className="btn-group">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={navigatePrev}
                    >
                      &lt;
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={navigateNext}
                    >
                      &gt;
                    </button>
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => setShowYearPicker(!showYearPicker)}
                    >
                      {calendarRef.current
                        ? new Intl.DateTimeFormat("en-US", {
                            month: "long",
                            year: "numeric",
                          }).format(calendarRef.current.getApi().getDate())
                        : new Intl.DateTimeFormat("en-US", {
                            month: "long",
                            year: "numeric",
                          }).format(new Date())}
                    </button>

                    {/* Year and Month Picker */}
                    {showYearPicker && (
                      <div
                        ref={yearPickerRef}
                        className="absolute z-10 mt-2 bg-white shadow-lg rounded-lg p-4 w-64"
                      >
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          {Array.from({ length: 12 }, (_, i) => {
                            const date = new Date();
                            date.setMonth(i);
                            return (
                              <button
                                key={i}
                                type="button"
                                className={`btn btn-sm ${
                                  calendarRef.current &&
                                  calendarRef.current
                                    .getApi()
                                    .getDate()
                                    .getMonth() === i
                                    ? "btn-primary"
                                    : "btn-ghost"
                                }`}
                                onClick={() => {
                                  const newDate = new Date(
                                    calendarRef.current
                                      ? calendarRef.current.getApi().getDate()
                                      : new Date()
                                  );
                                  newDate.setMonth(i);
                                  navigateToDate(newDate);
                                  setShowYearPicker(false);
                                }}
                              >
                                {date.toLocaleString("default", {
                                  month: "short",
                                })}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mb-4">
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Enter year"
                              className="input input-bordered input-sm w-full"
                              min="1900"
                              max="2100"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const input = e.currentTarget;
                                  const year = parseInt(input.value);
                                  if (year >= 1900 && year <= 2100) {
                                    const newDate = new Date(
                                      calendarRef.current
                                        ? calendarRef.current.getApi().getDate()
                                        : new Date()
                                    );
                                    newDate.setFullYear(year);
                                    navigateToDate(newDate);
                                    setShowYearPicker(false);
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={(e) => {
                                const input = e.currentTarget
                                  .previousSibling as HTMLInputElement;
                                const year = parseInt(input.value);
                                if (year >= 1900 && year <= 2100) {
                                  const newDate = new Date(
                                    calendarRef.current
                                      ? calendarRef.current.getApi().getDate()
                                      : new Date()
                                  );
                                  newDate.setFullYear(year);
                                  navigateToDate(newDate);
                                  setShowYearPicker(false);
                                }
                              }}
                            >
                              Go
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                          {Array.from({ length: 20 }, (_, i) => {
                            const year = new Date().getFullYear() - 10 + i;
                            return (
                              <button
                                key={i}
                                type="button"
                                className={`btn btn-sm ${
                                  calendarRef.current &&
                                  calendarRef.current
                                    .getApi()
                                    .getDate()
                                    .getFullYear() === year
                                    ? "btn-primary"
                                    : "btn-ghost"
                                }`}
                                onClick={() => {
                                  const newDate = new Date(
                                    calendarRef.current
                                      ? calendarRef.current.getApi().getDate()
                                      : new Date()
                                  );
                                  newDate.setFullYear(year);
                                  navigateToDate(newDate);
                                  setShowYearPicker(false);
                                }}
                              >
                                {year}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* View Controls */}
                <div className="btn-group">
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      viewMode === "dayGridMonth" ? "btn-primary" : "btn-ghost"
                    }`}
                    onClick={() => changeView("dayGridMonth")}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      viewMode === "timeGridWeek" ? "btn-primary" : "btn-ghost"
                    }`}
                    onClick={() => changeView("timeGridWeek")}
                  >
                    Week
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      viewMode === "timeGridDay" ? "btn-primary" : "btn-ghost"
                    }`}
                    onClick={() => changeView("timeGridDay")}
                  >
                    Day
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-96">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : (
              <div className="calendar-container">
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView={viewMode}
                  headerToolbar={false} // We're using our custom header
                  events={events}
                  dateClick={handleDateClick}
                  eventClick={handleEventClick}
                  editable={isAdmin || isSubAdmin}
                  selectable={isAdmin || isSubAdmin}
                  selectMirror={true}
                  dayMaxEvents={true}
                  weekends={true}
                  height="auto"
                  datesSet={(dateInfo) => {
                    // Update current date when calendar view changes
                    setCurrentDate(dateInfo.view.currentStart);

                    // Fetch events for the visible date range
                    if (communityId) {
                      const startDate = dateInfo.view.activeStart.toISOString();
                      const endDate = dateInfo.view.activeEnd.toISOString();

                      // Fetch events for this date range
                      apiClient
                        .getEvents(communityId, startDate, endDate)
                        .then((eventsData) => {
                          // Format events for FullCalendar
                          const formattedEvents = eventsData.map(
                            (event: IEvent) => ({
                              id: event._id,
                              title: event.title,
                              start: event.start,
                              end: event.end,
                              allDay: event.allDay,
                              description: event.description || "",
                              location: event.location || "",
                              color: event.color,
                              extendedProps: {
                                createdBy: event.createdBy,
                              },
                            })
                          );

                          setEvents(formattedEvents);
                        })
                        .catch(() => {
                          // Silent error handling
                        });
                    }

                    // Close year picker if open
                    if (showYearPicker) {
                      setShowYearPicker(false);
                    }
                  }}
                  eventTimeFormat={{
                    hour: "2-digit",
                    minute: "2-digit",
                    meridiem: "short",
                  }}
                  // Allow viewing events from past and future years
                  fixedWeekCount={false}
                  // Show more events on click
                  moreLinkClick="popover"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        event={selectedEvent}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        isAdmin={isAdmin || isSubAdmin}
      />
    </div>
  );
}

export default Calander;
