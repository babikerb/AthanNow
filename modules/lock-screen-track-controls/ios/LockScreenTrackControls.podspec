require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'LockScreenTrackControls'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'AthanNow'
  s.homepage       = 'https://github.com/babikerb/AthanNow'
  s.platforms      = { ios: '15.1' }
  s.swift_version  = '5.4'
  s.source         = { git: 'https://github.com/babikerb/AthanNow.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift}'
end
