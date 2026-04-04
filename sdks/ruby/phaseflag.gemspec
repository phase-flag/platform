# frozen_string_literal: true

require_relative "lib/phaseflag/version"

Gem::Specification.new do |spec|
  spec.name          = "phaseflag"
  spec.version       = PhaseFlag::VERSION
  spec.authors       = ["PhaseFlag"]
  spec.email         = ["sdk@phaseflag.dev"]

  spec.summary       = "Ruby SDK for the Phase Flag feature flag platform"
  spec.description   = "Provides local feature flag evaluation with background polling, " \
                        "server-side evaluation fallback, event batching, and change " \
                        "listeners for the Phase Flag feature flag platform."
  spec.homepage      = "https://github.com/phaseflag/sdk-ruby"
  spec.license       = "MIT"

  spec.required_ruby_version = ">= 2.7.0"

  spec.files = Dir["lib/**/*.rb"] + ["phaseflag.gemspec"]
  spec.require_paths = ["lib"]

  # No runtime dependencies -- uses net/http, uri, json from stdlib.
end
