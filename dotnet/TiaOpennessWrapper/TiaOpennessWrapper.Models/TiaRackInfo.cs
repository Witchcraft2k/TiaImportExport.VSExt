using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaRackInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("rackNumber")]
	public int RackNumber { get; set; }

	[JsonProperty("modules")]
	public List<TiaModuleInfo> Modules { get; set; } = new List<TiaModuleInfo>();
}
