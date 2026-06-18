import copy

import pytest
from fastapi.testclient import TestClient
from src.app import activities, app

client = TestClient(app)


def test_root_redirects_to_static_index():
    # Arrange
    url = "/"

    # Act
    response = client.get(url, follow_redirects=False)

    # Assert
    assert response.status_code == 307
    assert response.headers["location"] == "/static/index.html"


def test_get_activities_returns_all_activities():
    # Arrange
    url = "/activities"

    # Act
    response = client.get(url)

    # Assert
    assert response.status_code == 200
    assert response.json() == activities


def test_signup_for_activity_adds_participant():
    # Arrange
    activity_name = "Chess Club"
    email = "newstudent@mergington.edu"
    url = f"/activities/{activity_name}/signup"
    expected_message = f"Signed up {email} for {activity_name}"

    # Act
    response = client.post(url, params={"email": email})

    # Assert
    assert response.status_code == 200
    assert response.json() == {"message": expected_message}
    assert email in activities[activity_name]["participants"]


def test_signup_for_missing_activity_returns_404():
    # Arrange
    url = "/activities/Nonexistent/signup"
    email = "user@mergington.edu"

    # Act
    response = client.post(url, params={"email": email})

    # Assert
    assert response.status_code == 404
    assert response.json()["detail"] == "Activity not found"


@pytest.fixture(autouse=True)
def reset_activities():
    original = copy.deepcopy(activities)
    yield
    activities.clear()
    activities.update(original)


def test_signup_without_email_returns_validation_error(client):
    # Arrange
    url = "/activities/Chess Club/signup"

    # Act
    response = client.post(url)

    # Assert
    assert response.status_code == 422
    assert response.json()["detail"]
    assert any(error["loc"][-1] == "email" for error in response.json()["detail"])


def test_duplicate_signup_is_rejected(client):
    # Arrange
    activity_name = "Programming Class"
    email = "duplicate@mergington.edu"
    url = f"/activities/{activity_name}/signup"

    # Act
    first_response = client.post(url, params={"email": email})
    second_response = client.post(url, params={"email": email})

    # Assert
    assert first_response.status_code == 200
    assert second_response.status_code == 400
    assert second_response.json()["detail"] == "Student already signed up for this activity"
    assert activities[activity_name]["participants"].count(email) == 1


def test_signup_fails_when_activity_is_full(client):
    # Arrange
    activity_name = "Gym Class"
    email = "waitlist@mergington.edu"
    url = f"/activities/{activity_name}/signup"
    activities[activity_name]["participants"] = [f"student{i}@mergington.edu" for i in range(activities[activity_name]["max_participants"])]

    # Act
    response = client.post(url, params={"email": email})

    # Assert
    assert response.status_code == 400
    assert response.json()["detail"] == "Activity is full"
    assert email not in activities[activity_name]["participants"]
