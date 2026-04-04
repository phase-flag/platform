# Python SDK Quickstart

## Installation

```bash
pip install phaseflag-sdk
```

## Initialization

```python
from phaseflag import PhaseFlagClient

client = PhaseFlagClient(
    api_key="pf_env_your_api_key",
    api_url="https://api.phaseflag.dev",  # or your self-hosted URL
    polling_interval=30,                   # seconds
    context={
        "user_id": "user-123",
        "plan": "pro",
        "country": "US",
    },
)

client.initialize()
```

## Evaluating Flags

### Boolean Flags

```python
enabled = client.get_boolean_value("new-checkout", default=False)
if enabled:
    show_new_checkout()
else:
    show_legacy_checkout()
```

### String Flags

```python
theme = client.get_string_value("theme-color", default="blue")
```

### Number Flags

```python
rate_limit = client.get_number_value("api-rate-limit", default=100)
```

### JSON Flags

```python
config = client.get_json_value("dashboard-config", default={"layout": "grid"})
```

### Full Evaluation Detail

```python
detail = client.get_evaluation_detail("new-checkout")
print(detail.value)          # True
print(detail.variation_key)  # "enabled"
print(detail.reason)         # "targeting_match"
```

## Per-Request Context

```python
# Override context for a single evaluation
enabled = client.get_boolean_value(
    "new-checkout",
    default=False,
    context={"user_id": "user-456", "plan": "enterprise"},
)
```

## Django Integration

```python
# settings.py
PHASEFLAG_API_KEY = "pf_env_..."
PHASEFLAG_API_URL = "https://api.phaseflag.dev"

# middleware.py
from phaseflag.contrib.django import PhaseFlagMiddleware

MIDDLEWARE = [
    "phaseflag.contrib.django.PhaseFlagMiddleware",
    # ...
]

# views.py
from phaseflag import get_boolean_value

def checkout_view(request):
    if get_boolean_value("new-checkout", context={"user_id": str(request.user.id)}):
        return render(request, "checkout_v2.html")
    return render(request, "checkout.html")
```

## Flask Integration

```python
from flask import Flask
from phaseflag.contrib.flask import PhaseFlag

app = Flask(__name__)
pf = PhaseFlag(app, api_key="pf_env_...")

@app.route("/checkout")
def checkout():
    if pf.get_boolean_value("new-checkout", context={"user_id": current_user.id}):
        return render_template("checkout_v2.html")
    return render_template("checkout.html")
```

## Offline Mode

```python
import json

# Bootstrap from file
with open("phaseflag-bootstrap.json") as f:
    bootstrap = json.load(f)

client = PhaseFlagClient(
    api_key="pf_env_...",
    bootstrap_data=bootstrap,
    offline_fallback=True,
)
```

## Testing

```python
from phaseflag.testing import PhaseFlagTestClient

client = PhaseFlagTestClient(overrides={
    "new-checkout": True,
    "theme-color": "dark",
})

assert client.get_boolean_value("new-checkout") is True
```

## Async Support

```python
from phaseflag import AsyncPhaseFlagClient

client = AsyncPhaseFlagClient(api_key="pf_env_...")
await client.initialize()

enabled = await client.get_boolean_value("new-checkout", default=False)
```

## Cleanup

```python
client.close()
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `api_key` | str | required | Environment API key |
| `api_url` | str | `https://api.phaseflag.dev` | API base URL |
| `polling_interval` | int | `30` | Polling interval in seconds |
| `context` | dict | `{}` | Default evaluation context |
| `bootstrap_data` | dict | `None` | Pre-loaded flag data |
| `offline_fallback` | bool | `False` | Use defaults when API unreachable |
| `logger` | Logger | stdlib logger | Custom logger |
