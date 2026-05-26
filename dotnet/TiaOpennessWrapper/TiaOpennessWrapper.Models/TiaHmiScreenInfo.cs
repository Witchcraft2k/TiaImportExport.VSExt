using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaHmiScreenInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("screenType")]
	public string ScreenType { get; set; } = "Screen";
}
