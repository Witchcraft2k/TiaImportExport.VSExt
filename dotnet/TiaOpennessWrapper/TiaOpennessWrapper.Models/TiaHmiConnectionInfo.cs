using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaHmiConnectionInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("partner")]
	public string? Partner { get; set; }
}
