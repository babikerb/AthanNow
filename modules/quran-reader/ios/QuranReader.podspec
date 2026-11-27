require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'QuranReader'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'AthanNow'
  s.homepage       = 'https://github.com/babikerb/AthanNow'
  s.platforms      = { ios: '16.0' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/babikerb/AthanNow.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'SwiftUI', 'CoreText'

  s.source_files = '**/*.{h,m,mm,swift}'
  # The words of all 604 pages (scripts/build-mushaf-words.py) and the KFGQPC Hafs font, unmodified.
  s.resource_bundles = { 'QuranReaderResources' => ['QuranReaderResources/*'] }
end
