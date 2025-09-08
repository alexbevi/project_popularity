// Maven Central doesn't expose official download counts publicly for all artifacts.
// You can integrate with Sonatype/JFrog if you control the artifact, or skip downloads for Java.
export async function fetchMaven(coords) {
  return { weekly_downloads: 0 };
}