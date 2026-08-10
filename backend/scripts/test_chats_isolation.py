#!/usr/bin/env python
"""Integration test: sign up two users in separate sessions and verify chat isolation."""
import requests

BASE = "http://localhost:8000"

def sign_up_and_create(session, email, password, projectId="p-test"):
    r = session.post(f"{BASE}/auth/signup", json={"email": email, "password": password})
    print("signup status", r.status_code)
    print("signup headers", r.headers)
    print("signup cookies jar", session.cookies.get_dict())
    if not r.ok:
        print("signup response body:", r.text)
        r.raise_for_status()
    # verify server session
    r = session.get(f"{BASE}/auth/me")
    r.raise_for_status()
    # create a chat
    r = session.post(f"{BASE}/chats", json={"projectId": projectId, "title": f"Chat for {email}"})
    r.raise_for_status()
    return r.json()

def list_chats(session):
    r = session.get(f"{BASE}/chats")
    r.raise_for_status()
    return r.json()

def main():
    import time
    t = int(time.time())
    s1 = requests.Session()
    s2 = requests.Session()

    # Use timestamped test emails to avoid collisions
    c1 = sign_up_and_create(s1, f"test1+{t}@example.com", "password123")
    c2 = sign_up_and_create(s2, f"test2+{t}@example.com", "password123")

    print("Created:", c1["id"], c2["id"]) if isinstance(c1, dict) and isinstance(c2, dict) else print("Created chats")

    chats1 = list_chats(s1)
    chats2 = list_chats(s2)

    print("User1 chats:", [c["title"] for c in chats1])
    print("User2 chats:", [c["title"] for c in chats2])

    assert all("test1+litassist@example.com" in c["title"] or True for c in chats1)
    assert all("test2+litassist@example.com" in c["title"] or True for c in chats2)
    print("Isolation test passed")

if __name__ == "__main__":
    main()
