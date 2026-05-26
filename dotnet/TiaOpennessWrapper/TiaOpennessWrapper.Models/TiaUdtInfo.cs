using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaUdtInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("number")]
	public int? Number { get; set; }

	[JsonProperty("version")]
	public string? Version { get; set; }
}
