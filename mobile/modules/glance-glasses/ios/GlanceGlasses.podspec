Pod::Spec.new do |s|
  s.name = 'GlanceGlasses'
  s.version = '1.0.0'
  s.summary = 'Meta glasses camera for Glance inside Link'
  s.description = 'Streams the Meta glasses camera (Wearables Device Access Toolkit 1.0.1) to the embedded Glance page as JPEG frames. Nothing is saved or uploaded.'
  s.license = { :type => 'MIT' }
  s.author = 'MetaIntros'
  s.homepage = 'https://docs.expo.dev/modules/'
  s.platforms = { :ios => '17.2' }
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'UIKit', 'AVFAudio'
  s.swift_version = '5.0'
  s.source_files = '*.swift'
  # From https://github.com/facebook/meta-wearables-dat-ios 1.0.1 (scripts/fetch-meta-dat.sh puts them here).
  s.vendored_frameworks = 'Frameworks/MWDATCore.xcframework', 'Frameworks/MWDATCamera.xcframework'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
