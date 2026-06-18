document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const weeklyCalendarBody = document.getElementById("weekly-calendar-body");

  function parseSchedule(schedule) {
    if (!schedule || typeof schedule !== "string") {
      return { days: [], time: "" };
    }

    const parts = schedule.split(", ");
    const timePart = parts.slice(-1)[0];
    const dayPart = parts.slice(0, -1).join(", ");
    const dayNames = dayPart
      .split(/,\s*|\s+and\s+/i)
      .map((day) => day.trim())
      .filter(Boolean)
      .map((day) => day.replace(/s$/i, ""));

    const [startTime, endTime] = timePart.split(" - ").map((value) => value.trim());

    function parseToMinutes(value) {
      const [time, period] = value.split(" ");
      let [hour, minute] = time.split(":").map(Number);
      if (period === "PM" && hour !== 12) hour += 12;
      if (period === "AM" && hour === 12) hour = 0;
      return hour * 60 + minute;
    }

    function format24(value) {
      const [time, period] = value.split(" ");
      let [hour, minute] = time.split(":").map(Number);
      if (period === "PM" && hour !== 12) hour += 12;
      if (period === "AM" && hour === 12) hour = 0;
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }

    const duration = Math.max((parseToMinutes(endTime) - parseToMinutes(startTime)) / 60, 0);
    return {
      days: dayNames,
      time: `${format24(startTime)} - ${format24(endTime)}`,
      weeklyHours: (duration * dayNames.length).toFixed(1),
    };
  }

  function renderWeeklyCalendar(activities) {
    if (!weeklyCalendarBody) return;

    const orderedDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const activitySchedules = Object.entries(activities)
      .map(([name, details]) => ({ name, schedule: parseSchedule(details.schedule) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    weeklyCalendarBody.innerHTML = "";

    if (!activitySchedules.length) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = '<td colspan="8">No scheduled activities available</td>';
      weeklyCalendarBody.appendChild(emptyRow);
      return;
    }

    activitySchedules.forEach((activity) => {
      const row = document.createElement("tr");
      let rowCells = `<td>${activity.name}</td>`;

      orderedDays.forEach((day) => {
        const cellTime = activity.schedule.days.includes(day) ? activity.schedule.time : "";
        rowCells += `<td>${cellTime}</td>`;
      });

      row.innerHTML = rowCells;
      weeklyCalendarBody.appendChild(row);
    });
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;
        const participantCount = details.participants.length;
        const participantItems = participantCount
          ? details.participants
              .map(
                (email) =>
                  `<li><span class="participant-email">${email}</span><button type="button" class="participant-remove" data-activity="${name}" data-email="${email}" aria-label="Remove ${email}">×</button></li>`
              )
              .join("")
          : `<li class="empty">No participants yet</li>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants">
            <p><strong>Participants (${participantCount}):</strong></p>
            <ul class="participants-list">${participantItems}</ul>
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      renderWeeklyCalendar(activities);
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  activitiesList.addEventListener("click", async (event) => {
    const button = event.target.closest(".participant-remove");
    if (!button) return;

    const activity = button.dataset.activity;
    const email = button.dataset.email;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/participants/${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();
      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "Failed to remove participant.";
        messageDiv.className = "error";
      }
    } catch (error) {
      messageDiv.textContent = "Failed to remove participant. Please try again.";
      messageDiv.className = "error";
      console.error("Error removing participant:", error);
    }

    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  });

  // Initialize app
  fetchActivities();
});
