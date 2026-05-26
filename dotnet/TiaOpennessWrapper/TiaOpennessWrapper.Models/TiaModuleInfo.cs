using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaModuleInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("typeIdentifier")]
	public string TypeIdentifier { get; set; } = "";

	[JsonProperty("positionNumber")]
	public int PositionNumber { get; set; }

	[JsonProperty("slotNumber")]
	public int? SlotNumber { get; set; }

	[JsonProperty("orderNumber")]
	public string? OrderNumber { get; set; }

	[JsonProperty("firmwareVersion")]
	public string? FirmwareVersion { get; set; }

	[JsonProperty("comment")]
	public string? Comment { get; set; }

	[JsonProperty("moduleType")]
	public string ModuleType { get; set; } = "";

	[JsonProperty("isCpu")]
	public bool IsCpu { get; set; }

	[JsonProperty("isIoModule")]
	public bool IsIoModule { get; set; }

	[JsonProperty("addresses")]
	public TiaModuleAddressInfo? Addresses { get; set; }

	[JsonProperty("channels")]
	public List<TiaChannelInfo> Channels { get; set; } = new List<TiaChannelInfo>();

	[JsonProperty("subModules")]
	public List<TiaModuleInfo> SubModules { get; set; } = new List<TiaModuleInfo>();
}
