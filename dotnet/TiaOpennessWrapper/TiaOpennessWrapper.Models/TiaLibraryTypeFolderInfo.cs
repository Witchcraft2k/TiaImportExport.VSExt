using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaLibraryTypeFolderInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("parentId")]
	public string? ParentId { get; set; }

	[JsonProperty("folders")]
	public List<TiaLibraryTypeFolderInfo> Folders { get; set; } = new List<TiaLibraryTypeFolderInfo>();

	[JsonProperty("types")]
	public List<TiaLibraryTypeInfo> Types { get; set; } = new List<TiaLibraryTypeInfo>();
}
