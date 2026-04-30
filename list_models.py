import urllib.request, json
url = "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyDv99_u3Heii633CxU-qrvsK_XJv6g420c"
try:
  req = urllib.request.Request(url)
  with urllib.request.urlopen(req) as resp:
      data = json.loads(resp.read().decode('utf-8'))
      for m in data.get("models", []):
          print(m["name"])
except Exception as e:
  if hasattr(e, "read"):
    print(e.read().decode("utf-8"))
  else:
    print(e)
