import requests
import time

BASE = "http://localhost:8000"

def run():
    t = int(time.time())
    email = f"browser_test+{t}@example.com"
    password = "testpass123"
    s = requests.Session()
    print("Signing up:")
    r = s.post(f"{BASE}/auth/signup", json={"email": email, "password": password})
    print(r.status_code, r.text)
    print("Set-Cookie header:", r.headers.get('set-cookie'))
    print("Cookies after signup:", s.cookies.get_dict())

    # simulate fresh browser: new session
    s2 = requests.Session()
    print("Logging in with new session:")
    r2 = s2.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    print(r2.status_code, r2.text)
    print("Set-Cookie header on login:", r2.headers.get('set-cookie'))
    print("Cookies after login:", s2.cookies.get_dict())

    print("Request /auth/me using logged-in session:")
    r3 = s2.get(f"{BASE}/auth/me")
    print(r3.status_code, r3.text)

if __name__ == '__main__':
    run()
